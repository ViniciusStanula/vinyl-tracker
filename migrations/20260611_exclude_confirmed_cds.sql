-- CD-contamination incident (2026-06-11): soft-delete confirmed CDs.
-- 20 explicit-CD titles + 3 owner-confirmed silent CDs (see
-- _incident/cd-review-2026-06-11.csv). Rows are kept (no hard delete);
-- format='cd' removes them from every site surface and blocks recrawl.
UPDATE "Disco" SET format = 'cd', "updatedAt" = NOW()
WHERE asin IN (
    'B000052464',
    'B000057FA4',
    'B00005PT9L',
    'B00005PZ2H',
    'B00005UDV7',
    'B00007KK7V',
    'B003U43BP4',
    'B009E3EY38',
    'B00SGH8BH8',
    'B01L2F2Z5E',
    'B01MZ8H9IN',
    'B07PHH9D4X',
    'B07PHM4453',
    'B07SFJNH3Y',
    'B08M4Y1M56',
    'B08X65NPTP',
    'B097NL9D85',
    'B0B7L62RD8',
    'B0CZL9T1SR',
    'B0DF9R9DWP',
    'B0DW9J79PD',
    'B0F68PR8RT',
    'B0GZ4HRG1Z'
);
