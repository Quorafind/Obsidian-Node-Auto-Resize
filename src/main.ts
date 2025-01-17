import {
	Plugin,
	editorInfoField,
	App,
	PluginSettingTab,
	Setting,
	CanvasNode,
	debounce
} from 'obsidian';
import { EditorView, ViewUpdate } from "@codemirror/view";
import { adjustPositionsRecursively } from "./utils";

interface NodeAutoResizeSettings {
	maxWidth: number;
	widthAutoResize: boolean;
	trueWidth: boolean;
}

const DEFAULT_SETTINGS: NodeAutoResizeSettings = {
	maxWidth: 400,
	widthAutoResize: true,
	trueWidth: true
};

var trueCharacterWidth: Map<string, number>;

const updateNodeSize = (plugin: NodeAutoResizePlugin) => {
	return EditorView.updateListener.of((v: ViewUpdate) => {
		if (v.docChanged) {
			const editor = v.state.field(editorInfoField);
			if (editor.node) {
				const height = (v.view as EditorView).contentHeight;

				if (editor.node.height === height) return;
				let width = editor.node.width;

				if (plugin.settings.widthAutoResize) {
					
					const editorView = v.view as EditorView;
					const currentDoc = editorView.state.doc;
					if (plugin.settings.trueWidth){
						let longestLineLength = 0;
						for (const line of currentDoc.iterLines()){
							const headerNumber = countLeadingHashtags(line);
							const emfactor = getEmFactor(plugin.settings.emfactor, headerNumber);
							const lineCharacterWidths = Array.from(line).map(ch =>
								trueCharacterWidth.get(ch) ?? editorView.defaultCharacterWidth
							);
							const trueLineLength = lineCharacterWidths.reduce((acc, curr)=> acc+curr, 0);
							longestLineLength = Math.max(longestLineLength, trueLineLength * emfactor + 120);
						}
						width = longestLineLength;
					} else {
						const firstLineLength = currentDoc.line(1).length;
						const headerNumber = countLeadingHashtags(currentDoc.line(1).text);
						const emfactor = getEmFactor(headerNumber);
						width = editorView.defaultCharacterWidth * firstLineLength * emfactor + 120;
					}
					
				}
				

				const originalHeight = editor.node.height;
				const originalWidth = editor.node.width;

				const nodes = Array.from(editor.node.canvas.nodes.values()) as CanvasNode[];

				adjustPositionsRecursively({
					movedNode: editor.node,
					nodes,
				}, {
					adjustedHeight: height - originalHeight,
					adjustedWidth: plugin.settings.widthAutoResize ? (Math.max(width, plugin.settings.maxWidth) - originalWidth) : 0,
				});
				
				editor.node.resize({
					width: width > plugin.settings.maxWidth ? editor.node.width : width,
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
		this.registerEvent(this.app.workspace.on('css-change', populateTrueWidths)); //Repopulate on font change
		populateTrueWidths(); 														 //Populate the firs time the addon is loaded
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}


function measureCharacterWidths(font: string, size: string): Map<string, number> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Unable to get canvas 2D context"); // Should never fail in the context of Obsidian
    }
    ctx.font = `${size} ${font}`;
    const widthMap = new Map<string, number>();
    for (let charCode = 65; charCode <= 90; charCode++) { // A-Z
        const char = String.fromCharCode(charCode);
        widthMap.set(char, ctx.measureText(char).width);
    }
    for (let charCode = 97; charCode <= 122; charCode++) { // a-z
        const char = String.fromCharCode(charCode);
        widthMap.set(char, ctx.measureText(char).width);
    }
    return widthMap;
}

function populateTrueWidths(){
	const font = document.querySelector("body")?.getCssPropertyValue("font-family") ?? "Segeo UI"; //Will probably never fallback to segeo UI anyways
	const size = document.querySelector("body")?.getCssPropertyValue("font-size") ?? "15px"; //Will probably never fallback to segeo UI anyways
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
    return match ? match[0].length -1 : 0; // Return the length of the match or 0 if there are none
}

class NodeAutoResizeSettingTab extends PluginSettingTab {
	plugin: NodeAutoResizePlugin;

	constructor(app: App, plugin: NodeAutoResizePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Auto resize for width')
			.setDesc('Automatically resize the width of the node.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.widthAutoResize)
				.onChange(async (value) => {
					this.plugin.settings.widthAutoResize = value;
					await this.plugin.saveSettings();

					setTimeout(() => {
						this.display();
					}, 100);
				}));

		if (this.plugin.settings.widthAutoResize) {
			new Setting(containerEl)
				.setName("Max width for auto resize")
				.setDesc("The maximum width of the node.")
				.addText(text => text
					.setValue(this.plugin.settings.maxWidth.toString())
					.onChange(async (value) => {
						this.plugin.settings.maxWidth = parseInt(value);
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('True width as width')
				.setDesc('Calculate width according to widest line instead of the first.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.trueWidth)
					.onChange(async (value) => {
						this.plugin.settings.trueWidth = value;
						await this.plugin.saveSettings();
	
						setTimeout(() => {
							this.display();
						}, 100);
					}));
		}
	}
}
