This implementation is based on typo-js and it's purely async. it has been tested on en-GB and it-IT; dictionaries have been taken from https://github.com/elastic/hunspell/tree/master/dicts

Please note that those dictionaries do not handle "plurals" therefore if the word in present in the dictionary (and of course it is singular), then its plural form is not recognized as valid

Please note also that using spellcheck it is possible to have the "evidence" of a mispelled word (it is red-underlined); this spellcheck is independent from the language (it checks every language)

The logic implemented here is as follows:
- in the first textarea, when we type each word, after "space" or "enter" the suggestion below appears
- in the second textarea, when we type a "mispelled word" and we click on the "word" mispelled, the list of suggestions appear and once appeared we can click on the chosen word and the word replaces the others in the textarea