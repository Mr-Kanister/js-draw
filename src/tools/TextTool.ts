import Color4 from '../Color4';
import Text, { TextStyle } from '../components/Text';
import Editor from '../Editor';
import EditorImage from '../EditorImage';
import Mat33 from '../geometry/Mat33';
import { Vec2 } from '../geometry/Vec2';
import { PointerDevice } from '../Pointer';
import { EditorEventType, PointerEvt } from '../types';
import BaseTool from './BaseTool';
import { ToolType } from './ToolController';

const overlayCssClass = 'textEditorOverlay';
export default class TextTool extends BaseTool {
	public kind: ToolType = ToolType.Text;
	private textStyle: TextStyle;

	private textEditOverlay: HTMLElement;
	private textInputElem: HTMLInputElement|null = null;
	private textTargetPosition: Vec2|null = null;
	private textMeasuringCtx: CanvasRenderingContext2D|null = null;

	public constructor(private editor: Editor, description: string) {
		super(editor.notifier, description);
		this.textStyle = {
			size: 32,
			fontFamily: 'sans',
			renderingStyle: {
				fill: Color4.purple,
			},
		};

		this.textEditOverlay = document.createElement('div');
		this.textEditOverlay.classList.add(overlayCssClass);
		this.editor.addStyleSheet(`
			.${overlayCssClass} {
				height: 0;
				overflow: visible;
			}

			.${overlayCssClass} input {
				background-color: rgba(0, 0, 0, 0);
				border: none;
				padding: 0;
			}
		`);
		this.editor.createHTMLOverlay(this.textEditOverlay);
		this.editor.notifier.on(EditorEventType.ViewportChanged, () => this.updateTextInput());
	}

	private getTextAscent(text: string, style: TextStyle): number {
		this.textMeasuringCtx ??= document.createElement('canvas').getContext('2d');
		if (this.textMeasuringCtx) {
			Text.applyTextStyles(this.textMeasuringCtx, style);
			return this.textMeasuringCtx.measureText(text).actualBoundingBoxAscent;
		}

		// Estimate
		return style.size * 2 / 3;
	}

	private flushInput() {
		if (this.textInputElem && this.textTargetPosition) {
			const content = this.textInputElem.value;
			this.textInputElem.remove();
			this.textInputElem = null;

			const textTransform = Mat33.translation(
				this.textTargetPosition
			).rightMul(
				Mat33.scaling2D(this.editor.viewport.getSizeOfPixelOnCanvas())
			);
			
			const textComponent = new Text(
				[ content ],
				textTransform,
				this.textStyle,
			);

			const action = new EditorImage.AddElementCommand(textComponent);
			this.editor.dispatch(action);
		}
	}

	private updateTextInput() {
		if (!this.textInputElem || !this.textTargetPosition) {
			this.textInputElem?.remove();
			return;
		}

		const textScreenPos = this.editor.viewport.canvasToScreen(this.textTargetPosition);
		this.textInputElem.type = 'text';
		this.textInputElem.style.position = 'relative';
		this.textInputElem.style.left = `${textScreenPos.x}px`;
		this.textInputElem.style.fontFamily = this.textStyle.fontFamily;
		this.textInputElem.style.fontVariant = this.textStyle.fontVariant ?? '';
		this.textInputElem.style.fontWeight = this.textStyle.fontWeight ?? '';
		this.textInputElem.style.fontSize = `${this.textStyle.size}px`;
		this.textInputElem.style.color = this.textStyle.renderingStyle.fill.toHexString();
		const ascent = this.getTextAscent(this.textInputElem.value || 'W', this.textStyle);
		this.textInputElem.style.top = `${textScreenPos.y - ascent}px`;
	}

	private startTextInput(textCanvasPos: Vec2, initialText: string) {
		this.flushInput();

		this.textInputElem = document.createElement('input');
		this.textInputElem.value = initialText;
		this.textTargetPosition = textCanvasPos;
		this.updateTextInput();

		this.textInputElem.oninput = () => {
			if (this.textInputElem) {
				this.textInputElem.size = this.textInputElem?.value.length || 10;
			}
		};
		this.textInputElem.onblur = () => {
			this.flushInput();
		};

		this.textEditOverlay.replaceChildren(this.textInputElem);
		setTimeout(() => this.textInputElem!.focus(), 100);
	}

	public setEnabled(enabled: boolean) {
		super.setEnabled(enabled);

		if (!enabled) {
			this.flushInput();
		}

		this.textEditOverlay.style.display = enabled ? 'block' : 'none';
	}

	public onPointerDown({ current, allPointers }: PointerEvt): boolean {
		if (current.device === PointerDevice.Eraser) {
			return false;
		}

		if (allPointers.length === 1) {
			this.startTextInput(current.canvasPos, '');
			return true;
		}

		return false;
	}

	private dispatchUpdateEvent() {
		this.updateTextInput();
		this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
			kind: EditorEventType.ToolUpdated,
			tool: this,
		});
	}

	public setFontFamily(fontFamily: string) {
		if (fontFamily !== this.textStyle.fontFamily) {
			this.textStyle = {
				...this.textStyle,
				fontFamily: fontFamily,
			};

			this.dispatchUpdateEvent();
		}
	}

	public setColor(color: Color4) {
		if (!color.eq(this.textStyle.renderingStyle.fill)) {
			this.textStyle = {
				...this.textStyle,
				renderingStyle: {
					...this.textStyle.renderingStyle,
					fill: color,
				},
			};

			this.dispatchUpdateEvent();
		}
	}

	public setFontSize(size: number) {
		if (size !== this.textStyle.size) {
			this.textStyle = {
				...this.textStyle,
				size,
			};

			this.dispatchUpdateEvent();
		}
	}

	public getTextStyle(): TextStyle {
		return this.textStyle;
	}
}
