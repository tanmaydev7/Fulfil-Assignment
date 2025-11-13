import { defineConfig } from "@rspack/cli";
import { rspack, type SwcLoaderOptions } from "@rspack/core";
import { ReactRefreshRspackPlugin } from "@rspack/plugin-react-refresh";
import DotenvWebpackPlugin from "dotenv-webpack";
import path from 'path';
import { fileURLToPath } from 'url';

// Needed because __dirname and __filename are not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ["last 2 versions", "> 0.2%", "not dead", "Firefox ESR"];

export default defineConfig({
	entry: {
		main: "./src/main.tsx"
	},
	output: {
    filename: 'bundle.js',
    publicPath: '/', // ✅ Important for React Router
  },
	resolve: {
		extensions: ["...", ".ts", ".tsx", ".jsx"],
		alias: {
			'@':  path.resolve(__dirname),
		}
	},
	devServer: {
		historyApiFallback: true, // ensures index.html is served for all routes,
	},
	module: {
		rules: [
			{
				test: /\.svg$/,
				type: "asset"
			},
			{
				test: /\.(jsx?|tsx?)$/,
				use: [
					{
						loader: "builtin:swc-loader",
						options: {
							jsc: {
								parser: {
									syntax: "typescript",
									tsx: true
								},
								transform: {
									react: {
										runtime: "automatic",
										development: isDev,
										refresh: isDev
									}
								}
							},
							env: { targets }
						} satisfies SwcLoaderOptions
					}
				]
			},
			{
				test: /\.css$/,
				use: ["postcss-loader"],
				type: "css",
			},
		]
	},
	plugins: [
		new rspack.HtmlRspackPlugin({
			template: "./index.html"
		}),
		isDev ? new ReactRefreshRspackPlugin() : null,
		new DotenvWebpackPlugin({
			path: '../.env', // Path to .env file (this is the default)
		})
	],
	optimization: {
		minimizer: [
			new rspack.SwcJsMinimizerRspackPlugin(),
			new rspack.LightningCssMinimizerRspackPlugin({
				minimizerOptions: { targets }
			})
		]
	},
	experiments: {
		css: true
	},
});
