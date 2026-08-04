# Waits for the master-id backfill, then re-applies the narrowed layout gate.
#
# Sequential because both call Discogs: running them together would breach the
# 60 req/min limit rather than finish sooner.
#
# Both are resumable — each row leaves the candidate set as it is written — so
# a reboot or a kill costs only the record in flight, and re-running this file
# picks up from wherever it stopped.

$ErrorActionPreference = "Continue"
$py  = "C:\Users\Administrator\AppData\Local\Programs\Python\Python314\python.exe"
$dir = "C:\Users\Administrator\Documents\GitHub\vinyl-tracker\crawler"
Set-Location $dir

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" |
    Tee-Object -FilePath "$dir\tracklist_chain.log" -Append
}

Log "waiting for backfill_master_ids.py"
while ($true) {
  $running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
             Where-Object { $_.CommandLine -like "*backfill_master_ids.py*" }
  if (-not $running) { break }
  Start-Sleep -Seconds 60
}
Log "master ids finished"

Log "starting backfill_tracklists.py (~6.2k candidates, 2 calls each)"
& $py -u "$dir\backfill_tracklists.py" --apply `
    1>> "$dir\tracklists.log" 2>> "$dir\tracklists.err"
Log "tracklist backfill exited with code $LASTEXITCODE"
Log "ALL DONE"
