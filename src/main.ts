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
}

const DEFAULT_SETTINGS: NodeAutoResizeSettings = {
	maxWidth: 400,
	widthAutoResize: true,
};

const updateNodeSize = (plugin: NodeAutoResizePlugin) => {
	return EditorView.updateListener.of((v: ViewUpdate) => {
		if (v.docChanged) {
			const editor = v.state.field(editorInfoField);
			if (editor.node) {
				const height = (v.view as EditorView).contentHeight;

				if (editor.node.height === height) return;
				let width = editor.node.width;

				if (plugin.settings.widthAutoResize) {
					width = (v.view as EditorView).defaultCharacterWidth * (v.view as EditorView).state.doc.line(1).length + 120;
				}

				const originalHeight = editor.node.height;
				const originalWidth = editor.node.width;

				const nodes = Array.from(editor.node.canvas.nodes.values()) as CanvasNode[];

				adjustPositionsRecursively({
					movedNode: editor.node,
					nodes,
				}, {
					adjustedHeight: height - originalHeight,
					adjustedWidth: (width > plugin.settings.maxWidth ? editor.node.width : width) - originalWidth,
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
			.setName('Auto Resize Width')
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
				.setName("Max Width")
				.setDesc("The maximum width of the node.")
				.addText(text => text
					.setValue(this.plugin.settings.maxWidth.toString())
					.onChange(async (value) => {
						this.plugin.settings.maxWidth = parseInt(value);
						await this.plugin.saveSettings();
					}));
		}
	}
}
