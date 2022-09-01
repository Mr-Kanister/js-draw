import Editor from '../Editor';
import { ToolType } from '../tools/ToolController';
import { EditorEventType, StrokeDataPoint } from '../types';

import { coloris, init as colorisInit } from '@melloware/coloris';
import Color4 from '../Color4';
import Pen from '../tools/Pen';
import Eraser from '../tools/Eraser';
import BaseTool from '../tools/BaseTool';
import SelectionTool from '../tools/SelectionTool';
import { makeFreehandLineBuilder } from '../components/builders/FreehandLineBuilder';
import { Vec2 } from '../geometry/Vec2';
import SVGRenderer from '../rendering/renderers/SVGRenderer';
import Viewport from '../Viewport';
import EventDispatcher from '../EventDispatcher';
import { ComponentBuilderFactory } from '../components/builders/types';
import { makeArrowBuilder } from '../components/builders/ArrowBuilder';
import { makeLineBuilder } from '../components/builders/LineBuilder';
import { makeFilledRectangleBuilder, makeOutlinedRectangleBuilder } from '../components/builders/RectangleBuilder';
import { defaultToolbarLocalization, ToolbarLocalization } from './localization';

const primaryForegroundFill = `
	style='fill: var(--primary-foreground-color);'
`;
const primaryForegroundStrokeFill = `
	style='fill: var(--primary-foreground-color); stroke: var(--primary-foreground-color);'
`;

const toolbarCSSPrefix = 'toolbar-';
const svgNamespace = 'http://www.w3.org/2000/svg';

abstract class ToolbarWidget {
	protected readonly container: HTMLElement;
	private button: HTMLElement;
	private icon: Element|null;
	private dropdownContainer: HTMLElement;
	private dropdownIcon: Element;
	private label: HTMLLabelElement;
	private hasDropdown: boolean;

	public constructor(
		protected editor: Editor,
		protected targetTool: BaseTool,
		protected localizationTable: ToolbarLocalization,
	) {
		this.icon = null;
		this.container = document.createElement('div');
		this.container.classList.add(`${toolbarCSSPrefix}toolContainer`);
		this.dropdownContainer = document.createElement('div');
		this.dropdownContainer.classList.add(`${toolbarCSSPrefix}dropdown`);
		this.dropdownContainer.classList.add('hidden');
		this.hasDropdown = false;

		this.button = document.createElement('div');
		this.button.classList.add(`${toolbarCSSPrefix}button`);
		this.label = document.createElement('label');
		this.button.setAttribute('role', 'button');
		this.button.tabIndex = 0;

		this.button.onclick = () => {
			this.handleClick();
		};


		editor.notifier.on(EditorEventType.ToolEnabled, toolEvt => {
			if (toolEvt.kind !== EditorEventType.ToolEnabled) {
				throw new Error('Incorrect event type! (Expected ToolEnabled)');
			}

			if (toolEvt.tool === targetTool) {
				this.updateSelected(true);
			}
		});

		editor.notifier.on(EditorEventType.ToolDisabled, toolEvt => {
			if (toolEvt.kind !== EditorEventType.ToolDisabled) {
				throw new Error('Incorrect event type! (Expected ToolDisabled)');
			}

			if (toolEvt.tool === targetTool) {
				this.updateSelected(false);
				this.setDropdownVisible(false);
			}
		});
	}

	protected abstract getTitle(): string;
	protected abstract createIcon(): Element;

	// Add content to the widget's associated dropdown menu.
	// Returns true if such a menu should be created, false otherwise.
	protected abstract fillDropdown(dropdown: HTMLElement): boolean;

	protected handleClick() {
		if (this.hasDropdown) {
			if (!this.targetTool.isEnabled()) {
				this.targetTool.setEnabled(true);
			} else {
				this.setDropdownVisible(!this.isDropdownVisible());
			}
		} else {
			this.targetTool.setEnabled(!this.targetTool.isEnabled());
		}
	}

	// Adds this to [parent]. This can only be called once for each ToolbarWidget.
	public addTo(parent: HTMLElement) {
		this.label.innerText = this.getTitle();

		this.icon = null;
		this.updateIcon();

		this.updateSelected(this.targetTool.isEnabled());

		this.button.replaceChildren(this.icon!, this.label);
		this.container.appendChild(this.button);

		this.hasDropdown = this.fillDropdown(this.dropdownContainer);
		if (this.hasDropdown) {
			this.dropdownIcon = this.createDropdownIcon();
			this.button.appendChild(this.dropdownIcon);
			this.container.appendChild(this.dropdownContainer);
		}

		this.setDropdownVisible(false);
		parent.appendChild(this.container);
	}

	protected updateIcon() {
		const newIcon = this.createIcon();
		this.icon?.replaceWith(newIcon);
		this.icon = newIcon;
		this.icon.classList.add(`${toolbarCSSPrefix}icon`);
	}

	protected updateSelected(selected: boolean) {
		const currentlySelected = this.container.classList.contains('selected');
		if (currentlySelected === selected) {
			return;
		}

		if (selected) {
			this.container.classList.add('selected');
			this.button.ariaSelected = 'true';
		} else {
			this.container.classList.remove('selected');
			this.button.ariaSelected = 'false';
		}
	}

	protected setDropdownVisible(visible: boolean) {
		const currentlyVisible = this.container.classList.contains('dropdownVisible');
		if (currentlyVisible === visible) {
			return;
		}

		if (visible) {
			this.dropdownContainer.classList.remove('hidden');
			this.container.classList.add('dropdownVisible');
			this.editor.announceForAccessibility(
				this.localizationTable.dropdownShown(this.targetTool.description)
			);
		} else {
			this.dropdownContainer.classList.add('hidden');
			this.container.classList.remove('dropdownVisible');
			this.editor.announceForAccessibility(
				this.localizationTable.dropdownHidden(this.targetTool.description)
			);
		}
	}

	protected isDropdownVisible(): boolean {
		return !this.dropdownContainer.classList.contains('hidden');
	}

	private createDropdownIcon(): Element {
		const icon = document.createElementNS(svgNamespace, 'svg');
		icon.innerHTML = `
		<g>
			<path
				d='M5,10 L50,90 L95,10 Z'
				${primaryForegroundFill}
			/>
		</g>
		`;
		icon.classList.add(`${toolbarCSSPrefix}showHideDropdownIcon`);
		icon.setAttribute('viewBox', '0 0 100 100');
		return icon;
	}
}

class EraserWidget extends ToolbarWidget {
	protected getTitle(): string {
		return this.localizationTable.eraser;
	}
	protected createIcon(): Element {
		const icon = document.createElementNS(svgNamespace, 'svg');

		// Draw an eraser-like shape
		icon.innerHTML = `
		<g>
			<rect x=10 y=50 width=80 height=30 rx=10 fill='pink' />
			<rect
				x=10 y=10 width=80 height=50
				${primaryForegroundFill}
			/>
		</g>
		`;
		icon.setAttribute('viewBox', '0 0 100 100');

		return icon;
	}

	protected fillDropdown(_dropdown: HTMLElement): boolean {
		// No dropdown associated with the eraser
		return false;
	}
}

class SelectionWidget extends ToolbarWidget {
	public constructor(
		editor: Editor, private tool: SelectionTool, localization: ToolbarLocalization
	) {
		super(editor, tool, localization);
	}

	protected getTitle(): string {
		return this.localizationTable.select;
	}

	protected createIcon(): Element {
		const icon = document.createElementNS(svgNamespace, 'svg');

		// Draw a cursor-like shape
		icon.innerHTML = `
		<g>
			<rect x=10 y=10 width=70 height=70 fill='pink' stroke='black'/>
			<rect x=75 y=75 width=10 height=10 fill='white' stroke='black'/>
		</g>
		`;
		icon.setAttribute('viewBox', '0 0 100 100');

		return icon;
	}
	protected fillDropdown(dropdown: HTMLElement): boolean {
		const container = document.createElement('div');
		const resizeButton = document.createElement('button');
		const deleteButton = document.createElement('button');

		resizeButton.innerText = this.localizationTable.resizeImageToSelection;
		resizeButton.disabled = true;
		deleteButton.innerText = this.localizationTable.deleteSelection;
		deleteButton.disabled = true;

		resizeButton.onclick = () => {
			const selection = this.tool.getSelection();
			this.editor.dispatch(this.editor.setImportExportRect(selection!.region));
		};

		deleteButton.onclick = () => {
			const selection = this.tool.getSelection();
			this.editor.dispatch(selection!.deleteSelectedObjects());
			this.tool.clearSelection();
		};

		// Enable/disable actions based on whether items are selected
		this.editor.notifier.on(EditorEventType.ToolUpdated, toolEvt => {
			if (toolEvt.kind !== EditorEventType.ToolUpdated) {
				throw new Error('Invalid event type!');
			}

			if (toolEvt.tool === this.tool) {
				const selection = this.tool.getSelection();
				const hasSelection = selection && selection.region.area > 0;

				resizeButton.disabled = !hasSelection;
				deleteButton.disabled = resizeButton.disabled;
			}
		});

		container.replaceChildren(resizeButton, deleteButton);
		dropdown.appendChild(container);
		return true;
	}
}

class TouchDrawingWidget extends ToolbarWidget {
	protected getTitle(): string {
		return this.localizationTable.touchDrawing;
	}

	protected createIcon(): Element {
		const icon = document.createElementNS(svgNamespace, 'svg');

		// Draw a cursor-like shape
		icon.innerHTML = `
		<g>
			<path d='M11,-30 Q0,10 20,20 Q40,20 40,-30 Z' fill='blue' stroke='black'/>
			<path d='
				M0,90 L0,50 Q5,40 10,50
				L10,20 Q20,15 30,20
				L30,50 Q50,40 80,50
				L80,90 L10,90 Z'
				
				${primaryForegroundStrokeFill}
			/>
		</g>
		`;
		icon.setAttribute('viewBox', '-10 -30 100 100');

		return icon;
	}
	protected fillDropdown(_dropdown: HTMLElement): boolean {
		// No dropdown
		return false;
	}
	protected updateSelected(active: boolean) {
		if (active) {
			this.container.classList.remove('selected');
		} else {
			this.container.classList.add('selected');
		}
	}
}

class PenWidget extends ToolbarWidget {
	private updateInputs: ()=> void = () => {};

	public constructor(
		editor: Editor, private tool: Pen, localization: ToolbarLocalization, private penTypes: PenTypeRecord[]
	) {
		super(editor, tool, localization);

		this.editor.notifier.on(EditorEventType.ToolUpdated, toolEvt => {
			if (toolEvt.kind !== EditorEventType.ToolUpdated) {
				throw new Error('Invalid event type!');
			}

			// The button icon may depend on tool properties.
			if (toolEvt.tool === this.tool) {
				this.updateIcon();
				this.updateInputs();
			}
		});
	}

	protected getTitle(): string {
		return this.targetTool.description;
	}

	private makePenIcon(elem: SVGSVGElement) {
		// Use a square-root scale to prevent the pen's tip from overflowing.
		const scale = Math.round(Math.sqrt(this.tool.getThickness()) * 2);
		const color = this.tool.getColor();

		// Draw a pen-like shape
		const primaryStrokeTipPath = `M14,63 L${50 - scale},95 L${50 + scale},90 L88,60 Z`;
		const backgroundStrokeTipPath = `M14,63 L${50 - scale},85 L${50 + scale},83 L88,60 Z`;
		elem.innerHTML = `
		<defs>
			<pattern
				id='checkerboard'
				viewBox='0,0,10,10'
				width='20%'
				height='20%'
				patternUnits='userSpaceOnUse'
			>
				<rect x=0 y=0 width=10 height=10 fill='white'/>
				<rect x=0 y=0 width=5 height=5 fill='gray'/>
				<rect x=5 y=5 width=5 height=5 fill='gray'/>
			</pattern>
		</defs>
		<g>
			<!-- Pen grip -->
			<path
				d='M10,10 L90,10 L90,60 L${50 + scale},80 L${50 - scale},80 L10,60 Z'
				${primaryForegroundStrokeFill}
			/>
		</g>
		<g>
			<!-- Checkerboard background for slightly transparent pens -->
			<path d='${backgroundStrokeTipPath}' fill='url(#checkerboard)'/>

			<!-- Actual pen tip -->
			<path
				d='${primaryStrokeTipPath}'
				fill='${color.toHexString()}'
				stroke='${color.toHexString()}'
			/>
		</g>
		`;
	}

	// Draws an icon with the pen.
	private makeDrawnIcon(icon: SVGSVGElement) {
		const strokeFactory = this.tool.getStrokeFactory();

		const toolThickness = this.tool.getThickness();

		const nowTime = (new Date()).getTime();
		const startPoint: StrokeDataPoint = {
			pos: Vec2.of(10, 10),
			width: toolThickness / 5,
			color: this.tool.getColor(),
			time: nowTime - 100,
		};
		const endPoint: StrokeDataPoint = {
			pos: Vec2.of(90, 90),
			width: toolThickness / 5,
			color: this.tool.getColor(),
			time: nowTime,
		};

		const builder = strokeFactory(startPoint, this.editor.viewport);
		builder.addPoint(endPoint);

		const viewport = new Viewport(new EventDispatcher());
		viewport.updateScreenSize(Vec2.of(100, 100));
		const renderer = new SVGRenderer(icon, viewport);
		builder.preview(renderer);
	}

	protected createIcon(): Element {
		// We need to use createElementNS to embed an SVG element in HTML.
		// See http://zhangwenli.com/blog/2017/07/26/createelementns/
		const icon = document.createElementNS(svgNamespace, 'svg');
		icon.setAttribute('viewBox', '0 0 100 100');

		const strokeFactory = this.tool.getStrokeFactory();
		if (strokeFactory === makeFreehandLineBuilder) {
			this.makePenIcon(icon);
		} else {
			this.makeDrawnIcon(icon);
		}

		return icon;
	}

	private static idCounter: number = 0;
	protected fillDropdown(dropdown: HTMLElement): boolean {
		const container = document.createElement('div');

		const thicknessRow = document.createElement('div');
		const objectTypeRow = document.createElement('div');

		// Thickness: Value of the input is squared to allow for finer control/larger values.
		const thicknessLabel = document.createElement('label');
		const thicknessInput = document.createElement('input');
		const objectSelectLabel = document.createElement('label');
		const objectTypeSelect = document.createElement('select');

		// Give inputs IDs so we can label them with a <label for=...>Label text</label>
		thicknessInput.id = `${toolbarCSSPrefix}thicknessInput${PenWidget.idCounter++}`;
		objectTypeSelect.id = `${toolbarCSSPrefix}builderSelect${PenWidget.idCounter++}`;

		thicknessLabel.innerText = this.localizationTable.thicknessLabel;
		thicknessLabel.setAttribute('for', thicknessInput.id);
		objectSelectLabel.innerText = this.localizationTable.selectObjectType;
		objectSelectLabel.setAttribute('for', objectTypeSelect.id);

		thicknessInput.type = 'range';
		thicknessInput.min = '1';
		thicknessInput.max = '20';
		thicknessInput.step = '1';
		thicknessInput.oninput = () => {
			this.tool.setThickness(parseFloat(thicknessInput.value) ** 2);
		};
		thicknessRow.appendChild(thicknessLabel);
		thicknessRow.appendChild(thicknessInput);

		objectTypeSelect.oninput = () => {
			const penTypeIdx = parseInt(objectTypeSelect.value);
			if (penTypeIdx < 0 || penTypeIdx >= this.penTypes.length) {
				console.error('Invalid pen type index', penTypeIdx);
				return;
			}

			this.tool.setStrokeFactory(this.penTypes[penTypeIdx].factory);
		};
		objectTypeRow.appendChild(objectSelectLabel);
		objectTypeRow.appendChild(objectTypeSelect);

		const colorRow = document.createElement('div');
		const colorLabel = document.createElement('label');
		const colorInput = document.createElement('input');

		colorInput.id = `${toolbarCSSPrefix}colorInput${PenWidget.idCounter++}`;
		colorLabel.innerText = this.localizationTable.colorLabel;
		colorLabel.setAttribute('for', colorInput.id);

		colorInput.className = 'coloris_input';
		colorInput.type = 'button';
		colorInput.oninput = () => {
			this.tool.setColor(Color4.fromHex(colorInput.value));
		};
		colorInput.addEventListener('open', () => {
			this.editor.notifier.dispatch(EditorEventType.ColorPickerToggled, {
				kind: EditorEventType.ColorPickerToggled,
				open: true,
			});
		});
		colorInput.addEventListener('close', () => {
			this.editor.notifier.dispatch(EditorEventType.ColorPickerToggled, {
				kind: EditorEventType.ColorPickerToggled,
				open: false,
			});
		});

		colorRow.appendChild(colorLabel);
		colorRow.appendChild(colorInput);

		this.updateInputs = () => {
			colorInput.value = this.tool.getColor().toHexString();
			thicknessInput.value = Math.sqrt(this.tool.getThickness()).toString();

			objectTypeSelect.replaceChildren();
			for (let i = 0; i < this.penTypes.length; i ++) {
				const penType = this.penTypes[i];
				const option = document.createElement('option');
				option.value = i.toString();
				option.innerText = penType.name;

				objectTypeSelect.appendChild(option);

				if (penType.factory === this.tool.getStrokeFactory()) {
					objectTypeSelect.value = i.toString();
				}
			}
		};
		this.updateInputs();

		container.replaceChildren(colorRow, thicknessRow, objectTypeRow);
		dropdown.replaceChildren(container);
		return true;
	}
}

interface PenTypeRecord {
	name: string;
	factory: ComponentBuilderFactory;
}

export default class HTMLToolbar {
	private container: HTMLElement;
	private penTypes: PenTypeRecord[];

	public constructor(
		private editor: Editor, parent: HTMLElement,
		private localizationTable: ToolbarLocalization = defaultToolbarLocalization,
	) {
		this.container = document.createElement('div');
		this.container.classList.add(`${toolbarCSSPrefix}root`);
		this.container.setAttribute('role', 'toolbar');
		parent.appendChild(this.container);

		colorisInit();
		this.setupColorPickers();

		// Default pen types
		this.penTypes = [
			{
				name: localizationTable.freehandPen,
				factory: makeFreehandLineBuilder,
			},
			{
				name: localizationTable.arrowPen,
				factory: makeArrowBuilder,
			},
			{
				name: localizationTable.linePen,
				factory: makeLineBuilder,
			},
			{
				name: localizationTable.filledRectanglePen,
				factory: makeFilledRectangleBuilder,
			},
			{
				name: localizationTable.outlinedRectanglePen,
				factory: makeOutlinedRectangleBuilder,
			},
		];
	}

	public setupColorPickers() {
		const closePickerOverlay = document.createElement('div');
		closePickerOverlay.className = `${toolbarCSSPrefix}closeColorPickerOverlay`;
		this.editor.createHTMLOverlay(closePickerOverlay);

		coloris({
			el: '.coloris_input',
			format: 'hex',
			selectInput: false,
			focusInput: false,
			themeMode: 'auto',

			swatches: [
				Color4.red.toHexString(),
				Color4.purple.toHexString(),
				Color4.blue.toHexString(),
				Color4.clay.toHexString(),
				Color4.black.toHexString(),
				Color4.white.toHexString(),
			],
		});

		this.editor.notifier.on(EditorEventType.ColorPickerToggled, event => {
			if (event.kind !== EditorEventType.ColorPickerToggled) {
				return;
			}

			// Show/hide the overlay. Making the overlay visible gives users a surface to click
			// on that shows/hides the color picker.
			closePickerOverlay.style.display = event.open ? 'block' : 'none';
		});
	}

	public addActionButton(text: string, command: ()=> void, parent?: Element) {
		const button = document.createElement('button');
		button.innerText = text;
		button.classList.add(`${toolbarCSSPrefix}toolButton`);
		button.onclick = command;
		(parent ?? this.container).appendChild(button);

		return button;
	}

	private addUndoRedoButtons() {
		const undoRedoGroup = document.createElement('div');
		undoRedoGroup.classList.add(`${toolbarCSSPrefix}buttonGroup`);

		const undoButton = this.addActionButton('Undo', () => {
			this.editor.history.undo();
		}, undoRedoGroup);
		const redoButton = this.addActionButton('Redo', () => {
			this.editor.history.redo();
		}, undoRedoGroup);
		this.container.appendChild(undoRedoGroup);

		undoButton.disabled = true;
		redoButton.disabled = true;
		this.editor.notifier.on(EditorEventType.UndoRedoStackUpdated, event => {
			if (event.kind !== EditorEventType.UndoRedoStackUpdated) {
				throw new Error('Wrong event type!');
			}

			undoButton.disabled = event.undoStackSize === 0;
			redoButton.disabled = event.redoStackSize === 0;
		});
	}

	public addDefaultToolWidgets() {
		const toolController = this.editor.toolController;
		for (const tool of toolController.getMatchingTools(ToolType.Pen)) {
			if (!(tool instanceof Pen)) {
				throw new Error('All `Pen` tools must have kind === ToolType.Pen');
			}

			const widget = new PenWidget(
				this.editor, tool, this.localizationTable, this.penTypes,
			);
			widget.addTo(this.container);
		}

		for (const tool of toolController.getMatchingTools(ToolType.Eraser)) {
			if (!(tool instanceof Eraser)) {
				throw new Error('All Erasers must have kind === ToolType.Eraser!');
			}

			(new EraserWidget(this.editor, tool, this.localizationTable)).addTo(this.container);
		}

		for (const tool of toolController.getMatchingTools(ToolType.Selection)) {
			if (!(tool instanceof SelectionTool)) {
				throw new Error('All SelectionTools must have kind === ToolType.Selection');
			}

			(new SelectionWidget(this.editor, tool, this.localizationTable)).addTo(this.container);
		}

		for (const tool of toolController.getMatchingTools(ToolType.TouchPanZoom)) {
			(new TouchDrawingWidget(this.editor, tool, this.localizationTable)).addTo(this.container);
		}

		this.setupColorPickers();
	}

	public addDefaultActionButtons() {
		this.addUndoRedoButtons();
	}
}
