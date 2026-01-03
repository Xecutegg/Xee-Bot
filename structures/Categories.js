export const Categories = {
    INFO: {
        name: "Info",
        emoji: "<:info:1365651847435522098>",
        description: "Information and statistics commands"
    },
    MOD: {
        name: "Moderation",
        emoji: "<:MOD:1379449164919734353>",
        description: "Server moderation commands"
    },
    UTILS: {
        name: "Utility",
        emoji: "<:MekoAutomod:1379102013882892331>",
        description: "Utility and helper commands"
    },
    IDP: {
        name: "Password",
        emoji: "<:MekoFun:1379102025869951119>",
        description: "IDP management commands"
    },
    ONLYDEVS: {
        name: "Developer",
        emoji: "👨‍💻",
        description: "Bot developer only commands",
        hideInHelp: true
    },
};

export function getCategoryInfo(category) {
    return Categories[category?.toUpperCase()] || {
        name: category || "Other",
        emoji: "📁",
        description: "Other commands"
    };
}

export function getAllCategories() {
    return Object.keys(Categories);
}
