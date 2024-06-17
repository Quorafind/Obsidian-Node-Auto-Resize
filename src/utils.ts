import { CanvasGroupNode, CanvasNode } from "obsidian";

export function filterTouchingNodes(currentNode: CanvasNode, nodes: CanvasNode[]) {
	return nodes.filter(node => node.id !== currentNode.id && isTouching(currentNode, node));
}

export function filterBelowAndRight(currentNode: CanvasNode, nodes: CanvasNode[]) {
	const currentNodeLeft = currentNode.x;
	const currentNodeRight = currentNode.x + currentNode.width;
	const currentNodeTop = currentNode.y;
	const currentNodeBottom = currentNode.y + currentNode.height;

	return nodes.filter(node => {
		if (node.id === currentNode.id) {
			return false;
		}

		const nodeLeft = node.x;
		const nodeRight = node.x + node.width;
		const nodeTop = node.y;
		const nodeBottom = node.y + node.height;

		const isBelowAndNotFarRight = nodeTop >= currentNodeBottom && nodeRight > currentNodeLeft;
		const isRightAndNotFarBelow = nodeLeft >= currentNodeRight && nodeBottom < currentNodeTop;

		return isBelowAndNotFarRight || isRightAndNotFarBelow;
	});
}

export function filterNodesBottom(currentNode: CanvasNode, nodes: CanvasNode[]) {
	return nodes.filter(node => node.id !== currentNode.id && isTouchingBottom(currentNode, node));
}

export function filterNodesRight(currentNode: CanvasNode, nodes: CanvasNode[]) {
	return nodes.filter(node => node.id !== currentNode.id && isTouchingRight(currentNode, node));
}


export function isTouchingBottom(node1: CanvasNode, node2: CanvasNode) {
	const left1 = node1.x;
	const right1 = node1.x + node1.width;
	const top1 = node1.y;
	const bottom1 = node1.y + node1.height;

	const left2 = node2.x;
	const right2 = node2.x + node2.width;
	const top2 = node2.y;
	const bottom2 = node2.y + node2.height;

	return (Math.abs(bottom1 - top2) <= 20) &&
		(left1 < right2 && right1 > left2);
}

export function isTouchingRight(node1: CanvasNode, node2: CanvasNode) {
	const left1 = node1.x;
	const right1 = node1.x + node1.width;
	const top1 = node1.y;
	const bottom1 = node1.y + node1.height;

	const left2 = node2.x;
	const right2 = node2.x + node2.width;
	const top2 = node2.y;
	const bottom2 = node2.y + node2.height;

	return (Math.abs(right1 - left2) <= 20) &&
		(top1 < bottom2 && bottom1 > top2);
}

export function isTouching(node1: CanvasNode, node2: CanvasNode) {
	const left1 = node1.x;
	const right1 = node1.x + node1.width;
	const top1 = node1.y;
	const bottom1 = node1.y + node1.height;

	const left2 = node2.x;
	const right2 = node2.x + node2.width;
	const top2 = node2.y;
	const bottom2 = node2.y + node2.height;

	return (Math.abs(right1 - left2) <= 10) &&
		(top1 < bottom2 && bottom1 > top2) ||
		(Math.abs(bottom1 - top2) <= 10) &&
		(left1 < right2 && right1 > left2);
}

export function adjustPositionsRecursively({
											   movedNode, nodes
										   }: {
	movedNode: CanvasNode;
	nodes: CanvasNode[];
}, {
											   adjustedHeight,
											   adjustedWidth,
										   }: {
	adjustedHeight: number;
	adjustedWidth: number;
}) {
	const requestMoveQueue: {
		node: CanvasNode;
		moveTo: { x: number, y: number };
	}[] = [];

	for (const node of nodes) {
		const currentX = node.bbox.minX;
		const currentY = node.bbox.minY;

		if ((node as CanvasGroupNode).label) continue;

		if (isTouchingBottom(movedNode, node) && adjustedHeight !== 0) {
			requestMoveQueue.push({
				node,
				moveTo: {
					x: currentX,
					y: currentY + adjustedHeight + 20,
				},
			});

			adjustPositionsRecursively({
				movedNode: node,
				nodes: nodes.filter((n) => n.id !== movedNode.id),
			}, {
				adjustedHeight,
				adjustedWidth: 0,
			});
		} else if (isTouchingRight(movedNode, node) && adjustedWidth !== 0) {
			requestMoveQueue.push({
				node,
				moveTo: {
					x: currentX + adjustedWidth,
					y: currentY,
				},
			});

			adjustPositionsRecursively({
				movedNode: node,
				nodes: nodes.filter((n) => n.id !== movedNode.id),
			}, {
				adjustedHeight: 0,
				adjustedWidth,
			});
		}
	}

	requestMoveQueue.forEach(({node, moveTo}) => {
		node.moveTo(moveTo);
	});
}
