# Runs the remaining Discogs work unattended, in sequence.
#
# Sequential on purpose: both steps call the same API, and running them at once
# would either halve each one's throughput or breach the 60 req/min limit.
#
# Both steps are resumable — every record is stamped as it completes — so a
# reboot, a sleep, or killing this script costs only the record in flight.
# Re-running this file picks up wherever it stopped.

$ErrorActionPreference = "Continue"
$py  = "C:\Users\Administrator\AppData\Local\Programs\Python\Python314\python.exe"
$dir = "C:\Users\Administrator\Documents\GitHub\vinyl-tracker\crawler"
Set-Location $dir

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" |
    Tee-Object -FilePath "$dir\overnight.log" -Append
}

# ── 1. wait for the no-barcode pass already running ────────────────────────
Log "waiting for any running discogs_enrich.py to finish"
while ($true) {
  $running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
             Where-Object { $_.CommandLine -like "*discogs_enrich.py*" }
  if (-not $running) { break }
  Start-Sleep -Seconds 60
}
Log "no-barcode pass finished"

# ── 2. the combined backfill: ratings, have/want, and the Discogs artist ───
Log "starting backfill_discogs_community.py (~18k records, ~11h)"
& $py -u "$dir\backfill_discogs_community.py" --apply `
    1>> "$dir\backfill.log" 2>> "$dir\backfill.err"
Log "backfill exited with code $LASTEXITCODE"

# ── 3. one more no-barcode sweep ───────────────────────────────────────────
# The first pass leaves rows untouched whenever the API was unreachable, so a
# second run collects whatever a transient failure skipped.
Log "second no-barcode sweep for anything a transient failure skipped"
& $py -u "$dir\discogs_enrich.py" --no-barcode --apply `
    1>> "$dir\nobarcode2.log" 2>> "$dir\nobarcode2.err"
Log "second sweep exited with code $LASTEXITCODE"

Log "ALL DONE"
