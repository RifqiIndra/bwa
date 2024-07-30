const { makeWASocket, useMultiFileAuthState, downloadContentFromMessage, getContact } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { createSticker, StickerTypes } = require('wa-sticker-formatter');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// Path ke file JSON untuk menyimpan username
const USERNAMES_FILE = path.join(__dirname, 'usernames.json');

// Fungsi untuk memuat username dari file JSON
function loadUsernames() {
    try {
        const data = fs.readFileSync(USERNAMES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

// Fungsi untuk menyimpan username ke file JSON
function saveUsernames(usernames) {
    fs.writeFileSync(USERNAMES_FILE, JSON.stringify(usernames, null, 2));
}

// Muat username dari file saat startup
const usernames = loadUsernames();

async function connectWhatsapp() {
    const auth = await useMultiFileAuthState("session");
    const socket = makeWASocket({
        printQRInTerminal: true,
        browser: ["gaylifia", "", ""],
        auth: auth.state,
        logger: pino({ level: "silent" }),
    });

    socket.ev.on("creds.update", auth.saveCreds);
    socket.ev.on("connection.update", async ({ connection }) => {
        if (connection === "open") {
            console.log("BOT WHATSAPP SUDAH SIAP");
        } else if (connection === "close") {
            await connectWhatsapp();
        }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
        const chat = messages[0];
        const senderId = chat.key.participant || chat.key.remoteJid;
        const senderNumber = senderId.split('@')[0];
        const senderName = chat.pushName || 'Tidak Diketahui';

        const now = moment().tz("Asia/Jakarta");
        const formattedDate = now.format("DD-MM-YYYY");
        const formattedTime = now.format("HH:mm:ss");

        const pesan = (chat.message?.extendedTextMessage?.text ?? chat.message?.ephemeralMessage?.message?.extendedTextMessage?.text ?? chat.message?.conversation)?.toLowerCase() || "";
        const command = pesan.split(" ")[0];

        let featureUsed = '';
        let logMessage = '';

        switch (command) {
            case ".ping":
                featureUsed = 'Ping';
                await socket.sendMessage(chat.key.remoteJid, { text: "bot online." }, { quoted: chat });
                break;

            case ".h":
            case ".hidetag":
                featureUsed = 'Hidetag';
                const args = pesan.split(" ").slice(1).join(" ");

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const metadata = await socket.groupMetadata(chat.key.remoteJid);
                const participants = metadata.participants.map((v) => v.id);

                await socket.sendMessage(chat.key.remoteJid, {
                    text: args,
                    mentions: participants
                });

                break;

            case ".stop":
                if (senderNumber === '6285648144825') {
                    featureUsed = 'Stop';
                    await socket.sendMessage(chat.key.remoteJid, { text: "Bot akan berhenti." }, { quoted: chat });
                    await socket.sendMessage(chat.key.remoteJid, { text: "bot diberhentikan oleh owner." });
                    console.log('Bot dihentikan oleh 6285648144825');
                    process.exit(0);
                } else {
                    featureUsed = 'Stop Attempt';
                    await socket.sendMessage(chat.key.remoteJid, { text: "Kamu tidak memiliki izin untuk menghentikan bot." }, { quoted: chat });

                    const contact = await socket.onWhatsApp(senderId);
                    const contactInfo = `
Nomor: ${senderNumber}
Nama: ${senderName}
Bio: ${contact[0]?.profile?.status || 'Tidak ada bio'}
                    `.trim();

                    const logRecipient = "6285648144825@s.whatsapp.net";
                    await socket.sendMessage(logRecipient, { text: `Nomor yang mencoba menghentikan bot:\n${contactInfo}` });
                }
                break;

            case ".ban":
                featureUsed = 'Ban';
                const banNumber = pesan.split(" ")[1] + "@s.whatsapp.net";

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const groupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                const groupAdmins = groupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);

                if (!groupAdmins.includes(senderId)) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                    return;
                }

                await socket.groupParticipantsUpdate(chat.key.remoteJid, [banNumber], "remove");
                await socket.sendMessage(chat.key.remoteJid, { text: `Nomor ${banNumber.split('@')[0]} telah di-ban dari grup.` }, { quoted: chat });
                break;

                case ".add":
                    featureUsed = 'Add';
                    const addNumber = pesan.split(" ")[1] + "@s.whatsapp.net";
                
                    if (!chat.key.remoteJid.includes("@g.us")) {
                        await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                        return;
                    }
                
                    const addGroupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                    const addGroupAdmins = addGroupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);
                
                    const botId = socket.user.id;
                    console.log("Bot ID:", botId);
                    console.log("Group Admins:", addGroupAdmins);
                
                    if (!addGroupAdmins.includes(senderId)) {
                        await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                        return;
                    }
                
                    // Check if the bot is an admin
                    if (!addGroupAdmins.includes(botId)) {
                        await socket.sendMessage(chat.key.remoteJid, { text: "*Bot harus menjadi admin grup untuk menambahkan anggota!!*" }, { quoted: chat });
                        return;
                    }
                
                    try {
                        await socket.groupParticipantsUpdate(chat.key.remoteJid, [addNumber], "add");
                        await socket.sendMessage(chat.key.remoteJid, { text: `Nomor ${addNumber.split('@')[0]} telah ditambahkan ke grup.` }, { quoted: chat });
                    } catch (error) {
                        if (error.message === 'NotAdminException') {
                            await socket.sendMessage(chat.key.remoteJid, { text: "Kamu tidak memiliki izin untuk menambahkan anggota ke grup ini." }, { quoted: chat });
                        } else {
                            await socket.sendMessage(chat.key.remoteJid, { text: `Gagal menambahkan nomor ${addNumber.split('@')[0]} ke grup. [Unknown Error]` }, { quoted: chat });
                            console.error("Error adding member:", error);
                        }
                    }
                    break;
                
                

            case ".setadmin":
                featureUsed = 'Set Admin';
                const setAdminNumber = pesan.split(" ")[1] + "@s.whatsapp.net";

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const setAdminGroupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                const setAdminGroupAdmins = setAdminGroupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);

                if (!setAdminGroupAdmins.includes(senderId)) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                    return;
                }

                try {
                    await socket.groupParticipantsUpdate(chat.key.remoteJid, [setAdminNumber], "promote");
                    await socket.sendMessage(chat.key.remoteJid, { text: `Nomor ${setAdminNumber.split('@')[0]} telah dijadikan admin grup.` }, { quoted: chat });
                } catch (error) {
                    await socket.sendMessage(chat.key.remoteJid, { text: `Gagal menjadikan nomor ${setAdminNumber.split('@')[0]} sebagai admin grup.` }, { quoted: chat });
                }
                break;

            case ".removeadmin":
                featureUsed = 'Remove Admin';
                const removeAdminNumber = pesan.split(" ")[1] + "@s.whatsapp.net";

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const removeAdminGroupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                const removeAdminGroupAdmins = removeAdminGroupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);

                if (!removeAdminGroupAdmins.includes(senderId)) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                    return;
                }

                try {
                    await socket.groupParticipantsUpdate(chat.key.remoteJid, [removeAdminNumber], "demote");
                    await socket.sendMessage(chat.key.remoteJid, { text: `Nomor ${removeAdminNumber.split('@')[0]} telah dicopot dari admin grup.` }, { quoted: chat });
                } catch (error) {
                    await socket.sendMessage(chat.key.remoteJid, { text: `Gagal mencopot nomor ${removeAdminNumber.split('@')[0]} dari admin grup.` }, { quoted: chat });
                }
                break;

            case ".listmember":
                featureUsed = 'List Member';

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const listGroupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                const listGroupAdmins = listGroupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);

                if (!listGroupAdmins.includes(senderId)) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                    return;
                }

                const admins = [];
                const members = [];

                for (const participant of listGroupMetadata.participants) {
                    try {
                        const contact = await socket.onWhatsApp(participant.id);
                        const participantName = usernames[participant.id] || contact[0]?.notify || contact[0]?.name || "failed to get username";
                        const participantInfo = {
                            number: participant.id.split('@')[0],
                            name: participantName
                        };

                        if (participant.admin) {
                            admins.push(participantInfo);
                        } else {
                            members.push(participantInfo);
                        }
                    } catch (error) {
                        const participantInfo = {
                            number: participant.id.split('@')[0],
                            name: usernames[participant.id] || "failed to get username"
                        };

                        if (participant.admin) {
                            admins.push(participantInfo);
                        } else {
                            members.push(participantInfo);
                        }
                    }
                }

                let listMembers = `*${listGroupMetadata.subject} member:*\n\n*Admin*\n`;
                admins.forEach((admin, index) => {
                    listMembers += `${index + 1}. No: ${admin.number}\n    Username: ${admin.name}\n`;
                });

                listMembers += `\n*Member*\n`;
                members.forEach((member, index) => {
                    listMembers += `${index + 1}. No: ${member.number}\n    Username: ${member.name}\n`;
                });

                await socket.sendMessage(chat.key.remoteJid, { text: listMembers }, { quoted: chat });
                break;

            case ".feature":
                featureUsed = 'Feature List';

                // Daftar fitur untuk admin dan member
                const adminFeatures = [
                    '.ban',
                    '.add',
                    '.setadmin',
                    '.removeadmin',
                    '.listmember',
                    '.stop',
                    '.setname',
                ];

                const memberFeatures = [
                    '.ping',
                    '.h',
                    '.hidetag',
                    '.feature',
                    '.sticker',
                ];

                // Format pesan daftar fitur
                let featureMessage = "*List Feature yang hanya bisa digunakan oleh admin:*\n";
                adminFeatures.forEach((feature, index) => {
                    featureMessage += `${index + 1}. ${feature}\n`;
                });

                featureMessage += "\n*List Feature yang bisa digunakan member:*\n";
                memberFeatures.forEach((feature, index) => {
                    featureMessage += `${index + 1}. ${feature}\n`;
                });

                await socket.sendMessage(chat.key.remoteJid, { text: featureMessage }, { quoted: chat });
                break;

            case ".setname":
                featureUsed = 'Set Name';

                if (!chat.key.remoteJid.includes("@g.us")) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grup!!*" }, { quoted: chat });
                    return;
                }

                const setNameGroupMetadata = await socket.groupMetadata(chat.key.remoteJid);
                const setNameGroupAdmins = setNameGroupMetadata.participants.filter((participant) => participant.admin).map((admin) => admin.id);

                if (!setNameGroupAdmins.includes(senderId)) {
                    await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa digunakan oleh admin grup!!*" }, { quoted: chat });
                    return;
                }

                const [_, number, ...nameParts] = pesan.split(" ");
                const newName = nameParts.join(" ");
                const participantId = number + "@s.whatsapp.net";

                // Simpan username ke objek usernames dan file JSON
                usernames[participantId] = newName;
                saveUsernames(usernames);

                await socket.sendMessage(chat.key.remoteJid, { text: `Username untuk nomor ${number} telah diatur menjadi: ${newName}` }, { quoted: chat });
                break;

                case ".wujudasli":
                    featureUsed = 'Wujud Asli';
                    const targetNumber = pesan.split(" ")[1];
                    const targetId = targetNumber + "@s.whatsapp.net";
                    
                    const imagePaths = [
                        path.join(__dirname, 'member.jpg'),
                        path.join(__dirname, 'own.png'),
                        path.join(__dirname, 'tj.jpg'),
                        path.join(__dirname, 'jv.jpg'),
                        path.join(__dirname, 'jv2.jpg')
                    ];
                    
                    const getRandomImage = (paths) => paths[Math.floor(Math.random() * paths.length)];
                    
                    let imagePath;
                
                    if (targetNumber === "6285648144825") {
                        imagePath = path.join(__dirname, 'own.png'); 
                    } else {
                        imagePath = getRandomImage(imagePaths);
                    }
                
                    const imageBuffer = fs.readFileSync(imagePath);
                    const mentionedJidList = [targetId];
                    await socket.sendMessage(chat.key.remoteJid, {
                        image: imageBuffer,
                        caption: `wujud asli lu @${targetNumber}`,
                        mentions: mentionedJidList
                    }, { quoted: chat });
                    break;
                

            default:
                if (chat.message?.imageMessage?.caption == '.sticker' && chat.message?.imageMessage) {
                    featureUsed = 'Sticker';

                    const getMedia = async (msg) => {
                        const messageType = Object.keys(msg?.message)[0];
                        const stream = await downloadContentFromMessage(msg.message[messageType], messageType.replace('Message', ''));
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }

                        return buffer;
                    };

                    const mediaData = await getMedia(chat);
                    const stickerOption = {
                        pack: "gaylifia",
                        author: "inspeksi alat kelamin",
                        type: StickerTypes.FULL,
                        quality: 50
                    };

                    const generateSticker = await createSticker(mediaData, stickerOption);
                    await socket.sendMessage(chat.key.remoteJid, { sticker: generateSticker }); //langsung cobaaa
                }
                break;
        }

        if (featureUsed) {
            logMessage = `Perintah ${featureUsed} diterima pada ${formattedDate} ${formattedTime} dari ${senderNumber} (${senderName})`;
            console.log(logMessage);
            // Mengirimkan log ke nomor WhatsApp 085648144825
            const logRecipient = "6285648144825@s.whatsapp.net";
            await socket.sendMessage(logRecipient, { text: logMessage });
        }
    });
}

connectWhatsapp();
