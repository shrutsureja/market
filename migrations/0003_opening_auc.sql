-- Each sector's AUC at the start of the fortnight, as printed on the NSDL page (its first AUC group).
ALTER TABLE flows ADD COLUMN opening_auc REAL;
