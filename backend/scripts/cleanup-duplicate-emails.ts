/**
 * Cleanup duplicate users whose emails differ only by case (or whitespace).
 *
 * Usage (from backend/):
 *   npx ts-node scripts/cleanup-duplicate-emails.ts            # dry-run (default)
 *   npx ts-node scripts/cleanup-duplicate-emails.ts --apply    # actually delete
 *
 * Policy (as agreed): within each duplicate group, keep the user with the
 * newest createdAt. Delete the older ones. Lowercase+trim the surviving email.
 * Sessions belonging to deleted users are also removed.
 *
 * Does NOT touch gate logs (audit trail).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import type { ObjectId } from 'mongodb';

const APPLY = process.argv.includes('--apply');

type AnyDoc = Record<string, unknown> & { _id: ObjectId };

async function main(): Promise<void> {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI is not set');
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) throw new Error('No db connection');

    const users = db.collection<AnyDoc>('users');
    const sessions = db.collection<AnyDoc>('sessions');

    const groups = await users
        .aggregate<{ _id: string; docs: AnyDoc[]; count: number }>([
            {
                $addFields: {
                    _normEmail: {
                        $toLower: { $trim: { input: '$email' } },
                    },
                },
            },
            {
                $group: {
                    _id: '$_normEmail',
                    docs: { $push: '$$ROOT' },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    console.log(
        `Mode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}\n` +
            `Found ${groups.length} email(s) with case/whitespace duplicates.\n`,
    );

    let toDelete = 0;
    let toLowercase = 0;

    for (const g of groups) {
        const sorted = [...g.docs].sort((a, b) => {
            const ta = new Date(String(a.createdAt ?? 0)).getTime();
            const tb = new Date(String(b.createdAt ?? 0)).getTime();
            return tb - ta; // newest first
        });
        const [keeper, ...losers] = sorted;

        console.log(`\n== normalized email: ${g._id} (count=${g.count}) ==`);
        console.log(
            `  KEEP:   ${String(keeper._id)}  email="${String(
                keeper.email,
            )}"  status=${String(keeper.status)}  createdAt=${String(keeper.createdAt)}`,
        );
        for (const l of losers) {
            console.log(
                `  DELETE: ${String(l._id)}  email="${String(
                    l.email,
                )}"  status=${String(l.status)}  createdAt=${String(l.createdAt)}`,
            );
            toDelete++;
        }

        if (keeper.email !== g._id) {
            console.log(
                `  LOWERCASE keeper email: "${String(keeper.email)}" -> "${g._id}"`,
            );
            toLowercase++;
        }

        if (APPLY) {
            await users.deleteMany({ _id: { $in: losers.map((d) => d._id) } });
            await sessions.deleteMany({
                userId: { $in: losers.map((d) => String(d._id)) },
            });
            if (keeper.email !== g._id) {
                await users.updateOne(
                    { _id: keeper._id },
                    { $set: { email: g._id } },
                );
            }
        }
    }

    // Separately: users with no case-dupes but non-lowercased emails — normalize too.
    const nonNormalized = await users
        .find({
            $expr: {
                $ne: [
                    '$email',
                    { $toLower: { $trim: { input: '$email' } } },
                ],
            },
        })
        .toArray();

    const alreadyHandled = new Set(
        groups.flatMap((g) => g.docs.map((d) => String(d._id))),
    );
    const stragglers = nonNormalized.filter(
        (u) => !alreadyHandled.has(String(u._id)),
    );

    if (stragglers.length > 0) {
        console.log(
            `\n== ${stragglers.length} additional user(s) with non-normalized email (no dupes) ==`,
        );
        for (const u of stragglers) {
            const normalized = String(u.email).trim().toLowerCase();
            console.log(
                `  NORMALIZE: ${String(u._id)}  "${String(u.email)}" -> "${normalized}"`,
            );
            toLowercase++;
            if (APPLY) {
                await users.updateOne(
                    { _id: u._id },
                    { $set: { email: normalized } },
                );
            }
        }
    }

    console.log(
        `\nSummary: delete=${toDelete} user(s), lowercase=${toLowercase} user(s).` +
            (APPLY ? ' Applied.' : ' Dry-run only — re-run with --apply to execute.'),
    );

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
