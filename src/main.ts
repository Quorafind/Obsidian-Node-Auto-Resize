import {
	Plugin,
	editorInfoField,
	App,
	PluginSettingTab,
	Setting,
	CanvasNode,
	debounce,
} from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { adjustPositionsRecursively } from "./utils";

interface NodeAutoResizeSettings {
	maxWidth: number;
	widthAutoResize: boolean;
	trueWidth: boolean;
	emfactor: string;
	padding: number;
	cjkWidthFactor: number;
}

const DEFAULT_SETTINGS: NodeAutoResizeSettings = {
	maxWidth: 400,
	widthAutoResize: true,
	trueWidth: true,
	emfactor: "2.0,1.8,1.6,1.4,1.2,1.0",
	padding: 80,
	cjkWidthFactor: 1.8,
};

var trueCharacterWidth: Map<string, number>;

const updateNodeSize = (plugin: NodeAutoResizePlugin) => {
	return EditorView.updateListener.of((v: ViewUpdate) => {
		if (v.docChanged) {
			const editor = v.state.field(editorInfoField);
			if (editor?.node) {
				console.log(editor.node);
				const EXTRA_VERTICAL_PADDING = 18;
				const height = (v.view as EditorView).contentHeight + EXTRA_VERTICAL_PADDING;


				if (editor.node.height === height) return;
				let width = editor.node.width;

				if (plugin.settings.widthAutoResize) {
					const editorView = v.view as EditorView;
					const currentDoc = editorView.state.doc;
					if (plugin.settings.trueWidth) {
						let longestLineLength = 0;
						for (const line of currentDoc.iterLines()) {
							const headerNumber = countLeadingHashtags(line);
							const emfactor = getEmFactor(
								plugin.settings.emfactor,
								headerNumber
							);
							const lineCharacterWidths = Array.from(line).map(
								(ch) =>
									trueCharacterWidth.get(ch) ??
									(isCJKCharacter(ch)
										? editorView.defaultCharacterWidth *
										  plugin.settings.cjkWidthFactor
										: editorView.defaultCharacterWidth)
							);
							const trueLineLength = lineCharacterWidths.reduce(
								(acc, curr) => acc + curr,
								0
							);
							longestLineLength = Math.max(
								longestLineLength,
								trueLineLength * emfactor +
									plugin.settings.padding
							);
						}
						width = longestLineLength;
					} else {
						const firstLineLength = currentDoc.line(1).length;
						const headerNumber = countLeadingHashtags(
							currentDoc.line(1).text
						);
						const emfactor = getEmFactor(
							plugin.settings.emfactor,
							headerNumber
						);
						width =
							editorView.defaultCharacterWidth *
								firstLineLength *
								emfactor +
							plugin.settings.padding;
					}
				}

				const originalHeight = editor.node.height;
				const originalWidth = editor.node.width;

				const nodes = Array.from(
					editor.node.canvas.nodes.values()
				) as CanvasNode[];

				adjustPositionsRecursively(
					{
						movedNode: editor.node,
						nodes,
					},
					{
						adjustedHeight: height - originalHeight,
						adjustedWidth: plugin.settings.widthAutoResize
							? Math.max(width, plugin.settings.maxWidth) -
							  originalWidth
							: 0,
					}
				);

				editor.node.resize({
					width:
						width > plugin.settings.maxWidth
							? editor.node.width
							: width,
					height: height + 20,
				});

				plugin.debounceSaveCanvas(editor.node.canvas);
			}
		}
	});
};

export default class NodeAutoResizePlugin extends Plugin {
	settings: NodeAutoResizeSettings;

	public debounceSaveCanvas = debounce((canvas: any) => {
		canvas.requestSave();
	}, 200);

	async onload() {
		this.loadSettings();
		this.addSettingTab(new NodeAutoResizeSettingTab(this.app, this));
		this.registerEditorExtension([updateNodeSize(this)]);
		this.registerEvent(
			this.app.workspace.on("css-change", populateTrueWidths)
		); //Repopulate on font change
		populateTrueWidths(); //Populate the firs time the addon is loaded
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function measureCharacterWidths(
	font: string,
	size: string
): Map<string, number> {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Unable to get canvas 2D context"); // Should never fail in the context of Obsidian
	}
	ctx.font = `${size} ${font}`;
	const widthMap = new Map<string, number>();

	// 处理更多字符，包括数字、常用符号和标点
	// 基本拉丁字母（A-Z，a-z）
	for (let charCode = 65; charCode <= 90; charCode++) {
		// A-Z
		const char = String.fromCharCode(charCode);
		widthMap.set(char, ctx.measureText(char).width);
	}
	for (let charCode = 97; charCode <= 122; charCode++) {
		// a-z
		const char = String.fromCharCode(charCode);
		widthMap.set(char, ctx.measureText(char).width);
	}

	// 数字（0-9）
	for (let charCode = 48; charCode <= 57; charCode++) {
		const char = String.fromCharCode(charCode);
		widthMap.set(char, ctx.measureText(char).width);
	}

	// 常用符号和标点
	const symbols = "!@#$%^&*()-_=+[{]}\\|;:'\",<.>/? ";
	for (const char of symbols) {
		widthMap.set(char, ctx.measureText(char).width);
	}

	// 常用中文字符
	const commonCJKChars =
		"的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取持工反收结风称位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取持工体系低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严龙飞";
	for (const char of commonCJKChars) {
		widthMap.set(char, ctx.measureText(char).width);
	}

	return widthMap;
}

function populateTrueWidths() {
	const font =
		document.querySelector("body")?.getCssPropertyValue("font-family") ??
		"Segeo UI"; //Will probably never fallback to segeo UI anyways
	const size =
		document.querySelector("body")?.getCssPropertyValue("font-size") ??
		"15px"; //Will probably never fallback to segeo UI anyways
	trueCharacterWidth = measureCharacterWidths(font, size);
}

function getEmFactor(emfactor: string, headerNumber: number): number {
	if (headerNumber == 0 || headerNumber > 6) return 1.0;
	const emfactorArray = emfactor.split(",");
	const parsedValue = parseFloat(emfactorArray[headerNumber - 1]);

	return isNaN(parsedValue) ? 1.0 : parsedValue;
}

function countLeadingHashtags(input: string): number {
	const match = input.trimStart().match(/#+ /); // Match one or more '#' at the start of the string
	return match ? match[0].length - 1 : 0; // Return the length of the match or 0 if there are none
}

function isCJKCharacter(char: string): boolean {
	const code = char.charCodeAt(0);
	// 中文、日文、韩文的 Unicode 范围
	return (
		(code >= 0x4e00 && code <= 0x9fff) || // CJK 统一表意文字
		(code >= 0x3400 && code <= 0x4dbf) || // CJK 统一表意文字扩展 A
		(code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意文字
		(code >= 0xff00 && code <= 0xffef) || // 全角字符
		(code >= 0x3040 && code <= 0x309f) || // 日文平假名
		(code >= 0x30a0 && code <= 0x30ff) || // 日文片假名
		(code >= 0x3100 && code <= 0x312f) || // 汉语注音符号
		(code >= 0xac00 && code <= 0xd7af) || // 韩文
		(code >= 0x2e80 && code <= 0x2eff) || // CJK 部首补充
		(code >= 0x3000 && code <= 0x303f) // CJK 符号和标点
	);
}

class NodeAutoResizeSettingTab extends PluginSettingTab {
	plugin: NodeAutoResizePlugin;

	constructor(app: App, plugin: NodeAutoResizePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Auto resize for width")
			.setDesc("Automatically resize the width of the node.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.widthAutoResize)
					.onChange(async (value) => {
						this.plugin.settings.widthAutoResize = value;
						await this.plugin.saveSettings();

						setTimeout(() => {
							this.display();
						}, 100);
					})
			);

		if (this.plugin.settings.widthAutoResize) {
			new Setting(containerEl)
				.setName("Max width for auto resize")
				.setDesc("The maximum width of the node.")
				.addText((text) =>
					text
						.setValue(this.plugin.settings.maxWidth.toString())
						.onChange(async (value) => {
							this.plugin.settings.maxWidth = parseInt(value);
							await this.plugin.saveSettings();
						})
				);
			new Setting(containerEl)
				.setName("True width as width")
				.setDesc(
					"Calculate width according to widest line instead of the first."
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.trueWidth)
						.onChange(async (value) => {
							this.plugin.settings.trueWidth = value;
							await this.plugin.saveSettings();

							setTimeout(() => {
								this.display();
							}, 100);
						})
				);
			new Setting(containerEl)
				.setName("Content padding")
				.setDesc("Extra space to add around the content (in pixels).")
				.addText((text) =>
					text
						.setValue(this.plugin.settings.padding.toString())
						.onChange(async (value) => {
							this.plugin.settings.padding = parseInt(value);
							await this.plugin.saveSettings();
						})
				);
			new Setting(containerEl)
				.setName("CJK width factor")
				.setDesc(
					"Width multiplier for Chinese, Japanese, and Korean characters."
				)
				.addText((text) =>
					text
						.setValue(
							this.plugin.settings.cjkWidthFactor.toString()
						)
						.onChange(async (value) => {
							this.plugin.settings.cjkWidthFactor =
								parseFloat(value);
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
