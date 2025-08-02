import dicetherLint from "@dicether/eslint-config";
import {config} from "typescript-eslint";

export default config(
    {
        ignores: ["**/lib", "**/artifacts"],
    },
    dicetherLint,
    {
        files: ["**/test/**/*.ts"],
        rules: {
            // Disable rules that are not applicable to chai e.g. to.be.true
             "@typescript-eslint/no-unused-expressions": "off",
        },
    },
);
