const fs = require("fs");
const path = require("path");

const banListPath = path.join(__dirname, "../database/ban.json");

let banList = [];
const spamRecords = new Map();

if (fs.existsSync(banListPath)) {
    try {
        banList = JSON.parse(fs.readFileSync(banListPath));
    } catch (err) {
        console.error("Error reading ban.json:", err);
    }
}

async function banListener(ToxxicTech, m) {
    try {
        const from = m.key.remoteJid;
        const senderJid = m.key.participant || from;
        const botNumber = ToxxicTech.user.id.split(":")[0] + "@s.whatsapp.net";
        const isGroup = from.endsWith("@g.us");

        if (!banList.includes(senderJid)) return;

        let isAdmin = false;
        let isSuperAdmin = false;

        if (isGroup) {
            const metadata = await ToxxicTech.groupMetadata(from);
            const admins = metadata.participants.filter(p => p.admin != null).map(p => p.id);
            const superAdmins = metadata.participants.filter(p => p.admin === "superadmin").map(p => p.id);
            isAdmin = admins.includes(senderJid);
            isSuperAdmin = superAdmins.includes(senderJid);
        }

        const isBot = senderJid === botNumber;

        if (isAdmin || isSuperAdmin || isBot) return;

        // Track in-memory spam state
        if (!spamRecords.has(senderJid)) {
            spamRecords.set(senderJid, { count: 0, warnings: 0 });
        }

        const record = spamRecords.get(senderJid);
        record.count += 1;

        await ToxxicTech.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: false,
                id: m.key.id,
                participant: senderJid
            }
        });

        if ((record.count === 10 || record.count === 20) && record.warnings < 2) {
            record.warnings += 1;
            await ToxxicTech.sendMessage(from, {
                text: `⚠️ *Warning ${record.warnings}/2*\n@${senderJid.split("@")[0]}, you’re sending too many banned messages.\nYou’ll be kicked if it happens again.`,
                mentions: [senderJid]
            });
        }

        if (record.count >= 30) {
            await ToxxicTech.groupParticipantsUpdate(from, [senderJid], "remove");
            await ToxxicTech.sendMessage(from, {
                text: `🚨 *Spammer Removed*\n@${senderJid.split("@")[0]} was kicked after 3 spam waves.`,
                mentions: [senderJid]
            });
            spamRecords.delete(senderJid);
        } else {
            spamRecords.set(senderJid, record);
        }

    } catch (err) {
        console.error("❌ Ban listener error:", err);
    }
}

module.exports = banListener;