/**
 * @name USRBG
 * @description Allows you to USRBG banners.
 * @author Qb
 *         Tropical
 * @authorId 133659541198864384
 * @authorLink https://github.com/BleedingBD/
 * @version 1.1.1
 * @invite gj7JFa6mF8
 * @source https://github.com/BleedingBD/plugin-USRBG/blob/main/USRBG.plugin.js
 * @updateUrl https://raw.githubusercontent.com/BleedingBD/plugin-USRBG/main/USRBG.plugin.js
 */
const USRBG_ORIGINAL_PREMIUM_TYPE = Symbol('USRBG_ORIGINAL_PREMIUM_TYPE');
module.exports = class USRBG {
    constructor(meta) {
        this.meta = meta;
        this.api = new BdApi(meta.name);
        this.innerPatcher = new BdApi(this.meta.name + ' Inner Patcher').Patcher;

        const { Filters } = this.api.Webpack;
        this.replyBar = this.getModuleAndKey(Filters.byStrings('.shouldMention', '.showMentionToggle'));
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

        const ProfileBanner = this.getModuleAndKey(Filters.byStrings('darkenOnHover:'));

        Patcher.before(...ProfileBanner, (_thisArg, [props]) => {
            if (!props?.user?.id || !props?.displayProfile) return;

            const { user, displayProfile } = props;

            if (!database.has(user.id)) return;

            const { img } = database.get(props.user.id);

            displayProfile.banner = img;

            // This property is a getter, so this is the proper way to access it after overwriting it.
            Object.defineProperty(
                displayProfile,
                USRBG_ORIGINAL_PREMIUM_TYPE,
                Object.getOwnPropertyDescriptor(displayProfile.__proto__, 'premiumType'),
            );

            Object.defineProperty(displayProfile, 'premiumType', {
                get: () => 2,
                configurable: true,
            });
            Object.defineProperty(displayProfile, 'canUsePremiumProfileCustomization', {
                get: function () {
                    return PremiumChecker.isPremiumAtLeast(this[USRBG_ORIGINAL_PREMIUM_TYPE], 2);
                },
                configurable: true,
            });

            this.innerPatcher.after(displayProfile, 'getBannerURL', () => {
                return img;
            });
        });

        Patcher.after(...ProfileBanner, (_thisArg, [props]) => {
            this.innerPatcher.unpatchAll();
        });

        const UserAvatar = getByKeys(
            "UserPopoutBadgeList",
            "UserPopoutAvatar",
        );

        Patcher.before(UserAvatar, "default", (_thisArg, [props]) => {
            if (!props?.user?.id || !props?.displayProfile) return;

            const { user, displayProfile } = props;

            if (!database.has(user.id)) return;
            const { img } = database.get(props.user.id);

            displayProfile.banner = img;
        });
    }

    async getDatabase() {
        const json = await fetch('https://raw.githubusercontent.com/Discord-Custom-Covers/usrbg/master/dist/usrbg.json').then((r) =>
            r.json(),
        );
        return new Map(json.map((e) => [e.uid, e]));
    }

    stop() {
        this.api.Patcher.unpatchAll();
        this.innerPatcher.unpatchAll();
    }
};
