export async function resolveUserGlobal(client, query) {
    if (!query) return null;

    // Check if it's a mention
    const mentionMatch = query.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        try {
            return await client.users.fetch(mentionMatch[1]);
        } catch {
            return null;
        }
    }

    // Check if it's a user ID
    if (/^\d+$/.test(query)) {
        try {
            return await client.users.fetch(query);
        } catch {
            return null;
        }
    }

    // Search by username or tag
    const user = client.users.cache.find(u =>
        u.username.toLowerCase() === query.toLowerCase() ||
        u.tag.toLowerCase() === query.toLowerCase()
    );

    return user || null;
}
