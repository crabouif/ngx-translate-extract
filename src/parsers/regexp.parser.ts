import { tsquery } from '@phenomnomnominal/tsquery';

import { ParserInterface } from './parser.interface.js';
import { TranslationCollection } from '../utils/translation.collection.js';

const TRANSLATION_STRING_REGEX = /['"](dfa\.[\d\w.]+\|[^+]+?)['"]/g;

export class RegexpParser implements ParserInterface {
	public extract(source: string, filePath: string): TranslationCollection | null {
		const sourceFile = tsquery.ast(source, filePath);

		let collection: TranslationCollection = new TranslationCollection();

		const sourceText = sourceFile.text;

		const matches = sourceText.matchAll(TRANSLATION_STRING_REGEX);
		const keys: string[] = [];
		for (const match of matches) {
			if (match[1].includes('|http') || match[1].includes('|not-set')) {
				continue;
			}
			keys.push(match[1]);
		}
		if (keys.length > 0) {
			collection = collection.addKeys(keys);
		}
		return collection;
	}
}
