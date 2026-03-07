export default {
    prefix: ".",
    devs: ["162213250719547392", "901388818194780230"],
    color: "Red",
    link: "https://xecute.me",
    SUPPORT_SERVER: "https://discord.gg/yebpgrwdBh",

    dot_emoji: "<:dot:1379755442879594528>",
    cross_emoji: "<:xmark:1363906543782990108>",
    check_emoji: "<:check:1364097947951824946>",
    pen_emoji: "<:custom_emoji_2154:1394623088821538929>",
    left_emioji: "<:left:1412094230998028471>",
    right_emoji: "<:right:1412094177457737729>",
    loading_emoji: "<a:load:1378633006566215782>",
    premium_emoji: "<a:premium:1364129456767369216> ",
    verify_emoji: "<:media:1379102058841641120>",
    esports_emoji: "<:MekoFun:1379102025869951119>",
    mod_emoji: "<:MOD:1379449164919734353>",
    utlis_emoji: "<:MekoAutomod:1379102013882892331>",
    info_emoji: "<:MekoSearch:1379102022925680780>",
    new_emoji: "<:new1:1403974506057306193><:new2:1403974503335202856>",
    think_emoji: "<a:loading:1364098193511677963>",
    question_emoji: "<:topgg_ico_question:1417115696776745022>",
    info: "<:info:1365651847435522098> ",
    enabled: "<:enable:1379321394885562429>",
    disabled: "<:disable:1379321477769203724> ",

    FREE_LIMITIONS: {
        SCRIMS: 3,
        TOURNAMENTS: 1,
        SLOTMANAGER: 1,
        TAGCHECKS: 1,
        EASY_TAGS: 1,
        DROPS: 1,
    },

    EMBED_COLORS: {
        BOT_EMBED: "#068ADD",
        TRANSPARENT: "#36393F",
        SUCCESS: "#00A56A",
        ERROR: "#D61A3C",
        WARNING: "#F7E919",
    },

    MESSAGES: {
        API_ERROR:
            "Unexpected Backend Error! Try again later or contact support server",
        GENERAL_ERROR:
            "An error occurred while processing your request. Please try again later.",
        COMMAND_ERROR:
            "An error occurred while executing this command. Please try again later.",
        UNEXPECTED_ERROR: "An unexpected error occurred. Please try again later.",
        PERMISSION_ERROR: "You don't have permission to use this command.",
        NOT_FOUND_ERROR: "The requested resource was not found.",
    },

    MODERATION: {
        ENABLED: true,
    },

    PRESENCE: {
        ENABLED: true,
        STATUS: "dnd",
        ACTIVITIES: [
            { type: "LISTENING", message: "With . | .help" },
            { type: "WATCHING", message: "xecute.me" },
            {
                type: "PLAYING",
                message: "With You",
            },
            {
                type: "COMPLETELY",
                message: "Watching {members} User's & {servers} Server's",
            },
        ],
        INTERVAL: 15000, // 15 seconds in milliseconds (Discord recommends 15+ seconds)
        STREAMING_URL: "https://xecute.me/",
    },

    MUSIC: {
        ENABLED: true,
        LAVALINK_NODES: [
            {
                name: "Xeee",
                password: "glace",
                host: "de-01.strixnodes.com",
                port: 2010,
                secure: false
            }
        ],
        MAX_SEARCH_RESULTS: 10,
        DEFAULT_SOURCE: "ytsearch",
    },

    GIVEAWAYS: {
        ENABLED: false,
    },

    INTERACTIONS: {
        SLASH: true,
        CONTEXT: true,
    },
};
