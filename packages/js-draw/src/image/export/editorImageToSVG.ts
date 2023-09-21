import EditorImage, { PreRenderComponentCallback } from '../EditorImage';
import { Mat33 } from '@js-draw/math';
import SVGRenderer from '../../rendering/renderers/SVGRenderer';
import { svgLoaderAutoresizeClassName } from '../../SVGLoader';
import setExportedSVGSize, { SVGSizingOptions } from './setExportedSVGSize';

export interface SVGExportOptions extends SVGSizingOptions {
	// Defaults to false
	sanitize?: boolean;

	// Defaults to zero
	minDimension?: number;
}

// onComplete should return the same SVGElement returned by toSVGInternal
type RenderCallback = (renderer: SVGRenderer, onComplete: ()=>SVGElement)=>void;

const toSVGInternal = (
	image: EditorImage, renderFunction: RenderCallback, options: SVGExportOptions
) => {
	const importExportViewport = image.getImportExportViewport().getTemporaryClone();

	const { element: result, renderer } = SVGRenderer.fromViewport(
		importExportViewport, options.sanitize ?? false,
	);

	const origTransform = importExportViewport.canvasToScreenTransform;
	// Render with (0,0) at (0,0) — we'll handle translation with
	// the viewBox property.
	importExportViewport.resetTransform(Mat33.identity);

	// Use a callback rather than async/await to allow this function to create
	// both sync and async render functions
	renderFunction(renderer, () => {
		importExportViewport.resetTransform(origTransform);

		if (image.getAutoresizeEnabled()) {
			result.classList.add(svgLoaderAutoresizeClassName);
		} else {
			result.classList.remove(svgLoaderAutoresizeClassName);
		}

		setExportedSVGSize(result, importExportViewport, options);
		return result;
	});


	return result;
};

export const editorImageToSVGSync = (image: EditorImage, options: SVGExportOptions) => {
	return toSVGInternal(
		image,
		(renderer, onComplete) => {
			image.renderAll(renderer);
			onComplete();
		},
		options,
	);
};

export const editorImageToSVGAsync = (
	image: EditorImage, preRenderComponent: PreRenderComponentCallback, options: SVGExportOptions
) => {
	return new Promise<SVGElement>(resolve => {
		toSVGInternal(
			image,
			async (renderer, onComplete) => {
				await image.renderAllAsync(renderer, preRenderComponent);
				const result = onComplete();
				resolve(result);
			},
			options,
		);
	});
};

