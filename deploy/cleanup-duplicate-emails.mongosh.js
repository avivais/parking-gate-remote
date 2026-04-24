// Cleanup duplicate users whose emails differ only by case/whitespace.
//
// Usage (on the server):
//   # Dry-run (default):
//   docker exec -i parking-mongo mongosh parking-gate < deploy/cleanup-duplicate-emails.mongosh.js
//
//   # Apply:
//   docker exec -i -e APPLY=1 parking-mongo mongosh parking-gate < deploy/cleanup-duplicate-emails.mongosh.js
//
// Policy: within each duplicate group, keep the user with the newest createdAt;
// delete the older ones plus their sessions. Lowercase+trim the surviving email.
// Gate logs are never touched.

const APPLY = (process.env && process.env.APPLY === '1');
print('Mode: ' + (APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'));

const groups = db.users.aggregate([
    { $addFields: { _normEmail: { $toLower: { $trim: { input: '$email' } } } } },
    { $group: { _id: '$_normEmail', docs: { $push: '$$ROOT' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
]).toArray();

print('Found ' + groups.length + ' email(s) with case/whitespace duplicates.');

let toDelete = 0;
let toLowercase = 0;

for (const g of groups) {
    const sorted = g.docs.slice().sort(function (a, b) {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta; // newest first
    });
    const keeper = sorted[0];
    const losers = sorted.slice(1);

    print('');
    print('== normalized email: ' + g._id + ' (count=' + g.count + ') ==');
    print('  KEEP:   ' + keeper._id + '  email="' + keeper.email + '"  status=' + keeper.status + '  createdAt=' + keeper.createdAt);
    for (const l of losers) {
        print('  DELETE: ' + l._id + '  email="' + l.email + '"  status=' + l.status + '  createdAt=' + l.createdAt);
        toDelete++;
    }
    if (keeper.email !== g._id) {
        print('  LOWERCASE keeper email: "' + keeper.email + '" -> "' + g._id + '"');
        toLowercase++;
    }

    if (APPLY) {
        const loserIds = losers.map(function (d) { return d._id; });
        const loserIdStrs = losers.map(function (d) { return d._id.toString(); });
        db.users.deleteMany({ _id: { $in: loserIds } });
        db.sessions.deleteMany({ userId: { $in: loserIdStrs } });
        if (keeper.email !== g._id) {
            db.users.updateOne({ _id: keeper._id }, { $set: { email: g._id } });
        }
    }
}

// Separately: users with non-normalized emails but no case-dupes.
const handled = {};
for (const g of groups) {
    for (const d of g.docs) handled[d._id.toString()] = true;
}

const stragglers = db.users.find({
    $expr: { $ne: ['$email', { $toLower: { $trim: { input: '$email' } } }] },
}).toArray().filter(function (u) { return !handled[u._id.toString()]; });

if (stragglers.length > 0) {
    print('');
    print('== ' + stragglers.length + ' additional user(s) with non-normalized email (no dupes) ==');
    for (const u of stragglers) {
        const normalized = String(u.email).trim().toLowerCase();
        print('  NORMALIZE: ' + u._id + '  "' + u.email + '" -> "' + normalized + '"');
        toLowercase++;
        if (APPLY) {
            db.users.updateOne({ _id: u._id }, { $set: { email: normalized } });
        }
    }
}

print('');
print('Summary: delete=' + toDelete + ' user(s), lowercase=' + toLowercase + ' user(s).' +
    (APPLY ? ' Applied.' : ' Dry-run only — re-run with APPLY=1 to execute.'));
