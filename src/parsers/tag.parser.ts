import {
	parseTemplate,
	TmplAstNode as Node,
	TmplAstElement as Element,
	TmplAstText as Text,
	TmplAstTemplate as Template,
	TmplAstTextAttribute as TextAttribute,
	TmplAstBoundAttribute as BoundAttribute,
	AST,
	ASTWithSource,
	LiteralPrimitive,
	Conditional,
	Binary,
	BindingPipe,
	Interpolation,
	LiteralArray,
	LiteralMap
} from '@angular/compiler';

import { ParserInterface } from './parser.interface.js';
import { TranslationCollection } from '../utils/translation.collection.js';
import { isPathAngularComponent, extractComponentInlineTemplate } from '../utils/utils.js';

const TRANSLATE_TAG_NAME = 'translate';
const PUBLIC_TRANSLATE_TAG_NAME = 'public-translate';
const TRANSLATE_ATTR_KEY = 'key';
type ElementLike = Element | Template;

export class TagParser implements ParserInterface {
	public extract(source: string, filePath: string): TranslationCollection | null {
		let collection: TranslationCollection = new TranslationCollection();

		if (filePath && isPathAngularComponent(filePath)) {
			source = extractComponentInlineTemplate(source);
		}
		const nodes: Node[] = this.parseTemplate(source, filePath);
		const elements: ElementLike[] = this.getElementsWithTranslateTag(nodes);

		elements.forEach((element) => {
			const attribute = this.getAttribute(element, TRANSLATE_ATTR_KEY);
			if (attribute?.value) {
				collection = collection.add(attribute.value);
				return;
			}

			const boundAttribute = this.getBoundAttribute(element, TRANSLATE_ATTR_KEY);
			if (boundAttribute?.value) {
				this.getLiteralPrimitives(boundAttribute.value).forEach((literalPrimitive) => {
					collection = collection.add(literalPrimitive.value);
				});
				return;
			}

			const textNodes = this.getTextNodes(element);
			textNodes.forEach((textNode) => {
				collection = collection.add(textNode.value.trim());
			});
		});
		return collection;
	}

	/**
	 * Find all ElementLike nodes with a translate attribute
	 * @param nodes
	 */
	protected getElementsWithTranslateTag(nodes: Node[]): ElementLike[] {
		let elements: ElementLike[] = [];
		nodes.filter(this.isElementLike).forEach((element) => {
			if ((element as Element)?.name === TRANSLATE_TAG_NAME || (element as Element)?.name === PUBLIC_TRANSLATE_TAG_NAME) {
				if (this.hasAttribute(element, TRANSLATE_ATTR_KEY)) {
					elements = [...elements, element];
				}
				if (this.hasBoundAttribute(element, TRANSLATE_ATTR_KEY)) {
					elements = [...elements, element];
				}
			}
			const childElements = this.getElementsWithTranslateTag(element.children);
			if (childElements.length) {
				elements = [...elements, ...childElements];
			}
		});
		return elements;
	}

	/**
	 * Get direct child nodes of type Text
	 * @param element
	 */
	protected getTextNodes(element: ElementLike): Text[] {
		return element.children.filter(this.isText);
	}

	/**
	 * Check if attribute is present on element
	 * @param element
	 */
	protected hasAttribute(element: ElementLike, name: string): boolean {
		return this.getAttribute(element, name) !== undefined;
	}

	/**
	 * Get attribute value if present on element
	 * @param element
	 */
	protected getAttribute(element: ElementLike, name: string): TextAttribute {
		return element.attributes.find((attribute) => attribute.name === name);
	}

	/**
	 * Check if bound attribute is present on element
	 * @param element
	 * @param name
	 */
	protected hasBoundAttribute(element: ElementLike, name: string): boolean {
		return this.getBoundAttribute(element, name) !== undefined;
	}

	/**
	 * Get bound attribute if present on element
	 * @param element
	 * @param name
	 */
	protected getBoundAttribute(element: ElementLike, name: string): BoundAttribute {
		return element.inputs.find((input) => input.name === name);
	}

	/**
	 * Get literal primitives from expression
	 * @param exp
	 */
	protected getLiteralPrimitives(exp: AST): LiteralPrimitive[] {
		if (exp instanceof LiteralPrimitive) {
			return [exp];
		}

		let visit: AST[] = [];
		if (exp instanceof Interpolation) {
			visit = exp.expressions;
		} else if (exp instanceof LiteralArray) {
			visit = exp.expressions;
		} else if (exp instanceof LiteralMap) {
			visit = exp.values;
		} else if (exp instanceof BindingPipe) {
			visit = [exp.exp];
		} else if (exp instanceof Conditional) {
			visit = [exp.trueExp, exp.falseExp];
		} else if (exp instanceof Binary) {
			visit = [exp.left, exp.right];
		} else if (exp instanceof ASTWithSource) {
			visit = [exp.ast];
		}

		let results: LiteralPrimitive[] = [];
		visit.forEach((child) => {
			results = [...results, ...this.getLiteralPrimitives(child)];
		});
		return results;
	}

	/**
	 * Check if node type is ElementLike
	 * @param node
	 */
	protected isElementLike(node: Node): node is ElementLike {
		return node instanceof Element || node instanceof Template;
	}

	/**
	 * Check if node type is Text
	 * @param node
	 */
	protected isText(node: Node): node is Text {
		return node instanceof Text;
	}

	/**
	 * Parse a template into nodes
	 * @param template
	 * @param path
	 */
	protected parseTemplate(template: string, path: string): Node[] {
		return parseTemplate(template, path).nodes;
	}
}
