module.exports = {
    env: {
        "react-native/react-native": true,
    },
    plugins: ["react", "react-native"],
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:react-native/all",
        "plugin:@typescript-eslint/recommended",
    ],
};
