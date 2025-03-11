// THIS SCRIPT WAS MAINLY MADE FOR DISCORD WEBHOOKS
// TO CLARIFY, THE BOT WILL SEND THE FRIENDLIST THE FIRST TIME U LOAD IT IN THE NEW_FRIEND_WEBHOOK_URL AFTER THAT IT SAVES ONTO lastData.json
// YOU COULD TRY CHANGING THE DELAY AND SEE IF IT WORKS, 180000 MILLISECONDS WORKED THE BEST FOR ME

// REQUIRES AXIOS & FS MODULES TO WORK
// NPM INSTALL AXIOS FS

const axios = require('axios');
const fs = require('fs');

// Target
const profileUrl = 'ENTER PROFILE URL'; // Profile which you want to track

// Webhooks
const NEW_FRIEND_WEBHOOK_URL = 'ENTER WEBHOOK HERE'; // Webhook for new add
const REMOVED_FRIEND_WEBHOOK_URL = 'ENTER WEBHOOK HERE'; // Webhook for unadd
const AVATAR_UPDATE_WEBHOOK_URL = 'ENTER WEBHOOK HERE'; // Webhook for avatar updates

// Ping
const DISCORD_USER_ID = 'ENTER OWN DISCORD ID'; // Enter your own discord ID if you wanna get pinged on each notification

// Delay helper function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractUserIdFromUrl(url) {
    const match = url.match(/users\/(\d+)/);
    return match ? match[1] : null;
}

async function fetchFriends(userId) {
    try {
        const response = await axios.get(`https://friends.roblox.com/v1/users/${userId}/friends`);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching friends:', error);
        return [];
    }
}

async function getAvatarThumbnail(userId) {
    try {
        const response = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        return response.data.data[0].imageUrl;
    } catch (error) {
        console.error('Error fetching avatar thumbnail:', error);
        return null;
    }
}

// Webhook Embed
async function sendToWebhook(friend, webhookUrl, title, color, avatarUrl = null) {
    const profileUrl = `https://www.roblox.com/users/${friend.id}/profile`;
    
    const payload = {
        content: `<@${DISCORD_USER_ID}>`,
        embeds: [{
            title: `${title}: ${friend.name}`,
            url: profileUrl,
            color: color,
            thumbnail: avatarUrl ? { url: avatarUrl } : null,
            fields: [
                {
                    name: "Roblox",
                    value: `[Profile](${profileUrl})`
                }
            ],
            timestamp: new Date()
        }]
    };

    try {
        await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log(`Successfully sent ${title} ${friend.name} to the webhook.`);
    } catch (error) {
        console.error(`Error sending ${title} to webhook:`, error);
    }
}

function loadLastData() {
    try {
        if (fs.existsSync('lastData.json')) {
            const data = fs.readFileSync('lastData.json');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading last data:', error);
    }
    return { lastFriendList: {}, lastAvatarUrl: "" };
}

function saveLastData(lastFriendList, lastAvatarUrl) {
    try {
        fs.writeFileSync('lastData.json', JSON.stringify({ lastFriendList, lastAvatarUrl }));
    } catch (error) {
        console.error('Error saving last data:', error);
    }
}

async function trackFriendsAndAvatar(profileUrl) {
    const userId = extractUserIdFromUrl(profileUrl);
    if (!userId) {
        console.error('Could not extract Profile ID.');
        return;
    }

    let { lastFriendList, lastAvatarUrl } = loadLastData();

    setInterval(async () => {
        const currentFriendList = await fetchFriends(userId);
        let currentFriendMap = {};

        for (let friend of currentFriendList) {
            currentFriendMap[friend.id] = friend;
            if (!lastFriendList[friend.id]) {
                const avatarUrl = await getAvatarThumbnail(friend.id);
                await sendToWebhook(friend, NEW_FRIEND_WEBHOOK_URL, 'Added', 2303786, avatarUrl);
                await delay(4000);
            }
        }

        for (let friendId in lastFriendList) {
            if (!currentFriendMap[friendId]) {
                const removedFriend = lastFriendList[friendId];
                const avatarUrl = await getAvatarThumbnail(removedFriend.id);
                await sendToWebhook(removedFriend, REMOVED_FRIEND_WEBHOOK_URL, 'Unadded', 2303786, avatarUrl);
                await delay(4000);
            }
        }

        lastFriendList = {};
        for (let friend of currentFriendList) {
            lastFriendList[friend.id] = friend;
        }

        const currentAvatarUrl = await getAvatarThumbnail(userId);
        if (currentAvatarUrl && currentAvatarUrl !== lastAvatarUrl) {
            const userResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            const userName = userResponse.data.name;

            await sendToWebhook({ id: userId, name: userName }, AVATAR_UPDATE_WEBHOOK_URL, 'Avatar Updated', 2303786, currentAvatarUrl);
            lastAvatarUrl = currentAvatarUrl;
        }

        // Below is the Delay to avoid ratelimit
        saveLastData(lastFriendList, lastAvatarUrl);
        console.log('Checked for updates.');
    }, 180000);
}

trackFriendsAndAvatar(profileUrl);
