/**
 * @name USRBG
 * @description Allows you to view USRBG banners.
 * @author Qb, katlyn, Tropical
 * @authorId 133659541198864384
 * @authorLink https://github.com/BleedingBD/
 * @version 1.2.0
 * @invite gj7JFa6mF8
 * @source https://github.com/BleedingBD/plugin-USRBG/blob/main/USRBG.plugin.js
 * @updateUrl https://raw.githubusercontent.com/BleedingBD/plugin-USRBG/main/USRBG.plugin.js
 */
const USRBG_ORIGINAL_PREMIUM_TYPE = Symbol("USRBG_ORIGINAL_PREMIUM_TYPE");
const USRBG_ORIGINAL_BANNER = Symbol("USRBG_ORIGINAL_BANNER");
module.exports = class USRBG {
    constructor(meta) {
        this.meta = meta;
        this.api = new BdApi(meta.name);
        this.innerPatcher = new BdApi(this.meta.name + " Inner Patcher").Patcher;

        const { Filters } = this.api.Webpack;
        this.replyBar = this.getModuleAndKey(Filters.byStrings(".shouldMention", ".showMentionToggle"));
    }

    getModuleAndKey(filter, options) {
        const { getModule } = this.api.Webpack;
        let module;
        const value = getModule((e, m) => (filter(e) ? (module = m) : false), options || { searchExports: true });
        if (!module) return;
        return [module.exports, Object.keys(module.exports).find((k) => module.exports[k] === value)];
    }

    async start() {
        const {
            Patcher,
            Webpack: { Filters, getModule, getByKeys },
        } = this.api;

        const PremiumChecker = getModule((m) => m?.isPremiumAtLeast);

        const database = await this.getDatabase();

        const ProfileBanner = this.getModuleAndKey(Filters.byStrings("darkenOnHover:"));

        Patcher.before(...ProfileBanner, (_thisArg, [props]) => {
            if (!props?.user?.id || !props?.displayProfile) return;

            const { user, displayProfile } = props;

            if (!database.users.has(user.id)) return;

            const img = this.getImageUrl(database, user.id);
            displayProfile.banner = img;

            // This property is a getter, so this is the proper way to access it after overwriting it.
            Object.defineProperty(
                displayProfile,
                USRBG_ORIGINAL_PREMIUM_TYPE,
                Object.getOwnPropertyDescriptor(displayProfile.__proto__, "premiumType"),
            );

            Object.defineProperty(displayProfile, "premiumType", {
                get: () => 2,
                configurable: true,
            });
            Object.defineProperty(displayProfile, "canUsePremiumProfileCustomization", {
                get: function () {
                    return PremiumChecker.isPremiumAtLeast(this[USRBG_ORIGINAL_PREMIUM_TYPE], 2);
                },
                configurable: true,
            });

            this.innerPatcher.after(displayProfile, "getBannerURL", () => {
                return img;
            });
        });

        Patcher.after(...ProfileBanner, (_thisArg, [props]) => {
            this.innerPatcher.unpatchAll();
        });

        const UserAvatar = getByKeys("UserPopoutBadgeList", "UserPopoutAvatar");

        Patcher.before(UserAvatar, "default", (_thisArg, [props]) => {
            if (!props?.user?.id || !props?.displayProfile) return;

            const { user, displayProfile } = props;

            if (!database.users.has(user.id)) return;
            const img = this.getImageUrl(database, props.user.id);

            displayProfile[USRBG_ORIGINAL_BANNER] = displayProfile.banner;
            displayProfile.banner = img;
        });

        Patcher.after(UserAvatar, "default", (_thisArg, [props]) => {
            displayProfile.banner = displayProfile[USRBG_ORIGINAL_BANNER];
            delete displayProfile[USRBG_ORIGINAL_BANNER];
        });
    }

    getImageUrl(database, userId) {
        const { endpoint, bucket, prefix } = database;
        return `${endpoint}/${bucket}/${prefix}${userId}?${database.users.get(userId)}`;
    }

    async getDatabase() {
        const json = await fetch("https://usrbg.is-hardly.online/users").then((r) => r.json());
        return {
            ...json,
            users: new Map(Object.entries(json.users)),
        };
    }

    stop() {
        this.api.Patcher.unpatchAll();
        this.innerPatcher.unpatchAll();
    }
};
