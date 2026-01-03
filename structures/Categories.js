export const Categories = {
    INFO: {
        name: "Info",
        emoji: "ℹ️",
        description: "Information and statistics commands"
    },
    MOD: {
        name: "Moderation",
        emoji: "🛡️",
        description: "Server moderation commands"
    },
    UTILS: {
        name: "Utility",
        emoji: "🔧",
        description: "Utility and helper commands"
    },
    IDP: {
        name: "IDP",
        emoji: "🎮",
        description: "IDP management commands"
    },
    ONLYDEVS: {
        name: "Developer",
        emoji: "👨‍💻",
        description: "Bot developer only commands"
    },
    EVENTS: {
        name: "Events",
        emoji: "📅",
        description: "Event handling"
    }
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
