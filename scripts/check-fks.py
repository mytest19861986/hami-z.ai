import sqlite3
con = sqlite3.connect("/home/z/my-project/db/custom.db")
cur = con.cursor()
q = '''
SELECT m.name AS child_table, f."table" AS parent_table, f."from" AS fk_col
FROM sqlite_master m
JOIN pragma_foreign_key_list(m.name) f
WHERE f."table" IN ('WalletTransaction','Wallet','PlanHolder','Membership','Purchase','Commission','SettlementRequest')
ORDER BY 2, 1
'''
for row in cur.execute(q):
    print(row)
con.close()
