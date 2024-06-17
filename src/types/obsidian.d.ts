import "obsidian";

declare module "obsidian" {
	interface MarkdownFileInfo {
		node: CanvasNode;
	}

	interface CanvasNode {
		id: string;
		moveAndResize: (props: { x: number, y: number, width: number, height: number }) => void;
		canvas: any;
		x: number;
		y: number;
		width: number;
		height: number;
		moveTo: (props: { x: number, y: number }) => void;
		resize: (props: { width: number, height: number }) => void;
		bbox: { minX: number, minY: number, maxX: number, maxY: number };
	}
}
