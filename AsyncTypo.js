class AsyncTypo {
    constructor(dictionary, dictionaryPath) {
        if (!dictionary || !dictionaryPath) {
            throw new Error('Both dictionary name and dictionary path must be provided');
        }

        this.dictionary = dictionary;
        this.dictionaryPath = dictionaryPath;
        this.dictionaryTable = {};
        this.rules = {};
        this.replacementTable = [];
        this.flags = {};
        this.memoized = {};
        this.loaded=false;
    }

    async loadAsync() {
        try {
            const affData = await this.fetchFile(`${this.dictionaryPath}/${this.dictionary}/${this.dictionary}.aff`);
            const wordsData = await this.fetchFile(`${this.dictionaryPath}/${this.dictionary}/${this.dictionary}.dic`);
            this.setup(affData, wordsData);
            this.loaded=true;
            console.log('Dictionary loaded successfully');
        } catch (error) {
            console.error('Error loading dictionary:', error);
        }
    }

    async fetchFile(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }

    async setup(affData, wordsData) {
        this.rules = this._parseAFF(affData);
        
        //this.dictionaryTable = this._parseDIC(wordsData);
        this.dictionaryTable = await this._parseDIC(wordsData);
        
        console.log('Setup complete. Dictionary is ready to use.');
    }

    async _parseAFF(data) {
        let rules = {};
        
        let lines = data.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            let line = this._removeAffixComments(lines[i]).trim();
            if (!line) continue;

            let definitionParts = line.split(/\s+/);
            let ruleType = definitionParts[0];
            
            if (ruleType === "PFX" || ruleType === "SFX") {
                let ruleCode = definitionParts[1];
                let combineable = definitionParts[2];
                let numEntries = parseInt(definitionParts[3], 10);
                let entries = [];

                for (let j = i + 1; j < i + 1 + numEntries; j++) {
                    let subline = lines[j];
                    let lineParts = subline.split(/\s+/);
                    let charactersToRemove = lineParts[2];
                    let additionParts = lineParts[3].split("/");
                    let charactersToAdd = additionParts[0] === "0" ? "" : additionParts[0];
                    let continuationClasses = this._parseRuleCodes(additionParts[1]);
                    let regexToMatch = lineParts[4];

                    let entry = {
                        add: charactersToAdd,
                        continuationClasses: continuationClasses,
                        match: regexToMatch !== "." ? new RegExp(`^${regexToMatch}`) : null,
                        remove: charactersToRemove !== "0" ? new RegExp(`${charactersToRemove}$`) : null
                    };

                    if (ruleType === "SFX") {
                        entry.match = regexToMatch !== "." ? new RegExp(`${regexToMatch}$`) : null;
                    }

                    entries.push(entry);
                }

                rules[ruleCode] = {
                    type: ruleType,
                    combineable: combineable === "Y",
                    entries: entries
                };

                i += numEntries;
            } else if (ruleType === "REP") {
                if (definitionParts.length === 3) {
                    this.replacementTable.push([definitionParts[1], definitionParts[2]]);
                }
            } else {
                // Handling flags and other configurations
                this.flags[ruleType] = definitionParts[1];
            }
        }

        this.rules = rules;
    }

    _removeAffixComments(line) {
        return line.startsWith('#') ? '' : line;
    }

    _parseRuleCodes(codes) {
        // Parse rule codes (you might already have this logic from your previous implementation)
        return codes ? codes.split(',') : [];
    }

    // Placeholder for _parseDIC method, needs implementation based on your existing logic
    async _parseDIC(data) {
		data = this._removeDicComments(data);
		
		var lines = data.split(/\r?\n/);
		var dictionaryTable = {};
		
		function addWord(word, rules) {
        
			// Some dictionaries will list the same word multiple times with different rule sets.
			if (!dictionaryTable.hasOwnProperty(word)) {
				dictionaryTable[word] = null;
			}
			
			if (rules.length > 0) {
				if (dictionaryTable[word] === null) {
					dictionaryTable[word] = [];
				}

				dictionaryTable[word].push(rules);
			}
		}

//console.log(lines.length)
		// The first line is the number of words in the dictionary.
		for (var i = 1, _len = lines.length; i < _len; i++) {
    //for (var i = 1, _len = 80000; i < _len; i++) {
			var line = lines[i];

      //// DEGUG
    //   if (i % 1000 == 0)
    //     console.log(line)
      
      if (!line) {
				// Ignore empty lines.
				continue;
			}

			var parts = line.split("/", 2);
			
			var word = parts[0];

			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodesArray = this._parseRuleCodes(parts[1]);
				
				// Save the ruleCodes for compound word situations.
				if (!("NEEDAFFIX" in this.flags) || ruleCodesArray.indexOf(this.flags.NEEDAFFIX) == -1) {
					addWord(word, ruleCodesArray);
				}
				
				for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
					var code = ruleCodesArray[j];
					
					var rule = this.rules[code];
					
					if (rule) {
						var newWords = this._applyRule(word, rule);
						
						for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
							var newWord = newWords[ii];
							
							addWord(newWord, []);
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodesArray[k];
									
									var combineRule = this.rules[combineCode];
									
									if (combineRule) {
										if (combineRule.combineable && (rule.type != combineRule.type)) {
											var otherNewWords = this._applyRule(newWord, combineRule);
											
											for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
												var otherNewWord = otherNewWords[iii];
												addWord(otherNewWord, []);
											}
										}
									}
								}
							}
						}
					}
					
					
				}
			}
			else {
				addWord(word.trim(), []);
			}
		}
		//console.log(dictionaryTable)
		return dictionaryTable;
	}

    _removeDicComments(data) {
		// I can't find any official documentation on it, but at least the de_DE
		// dictionary uses tab-indented lines as comments.
		
		// Remove comments
		data = data.replace(/^\t.*$/mg, "");
		
		return data;
	}

    _applyRule(word, rule) {
        const entries = rule.entries;
        let newWords = [];
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            // Check if the rule should be applied
            if (!entry.match || word.match(entry.match)) {
                let newWord = word;
                
                // If there's text to remove according to the rule, remove it
                if (entry.remove) {
                    newWord = newWord.replace(entry.remove, "");
                }
                
                // Add the affix to the word according to the rule type (prefix/suffix)
                if (rule.type === "SFX") {
                    newWord += entry.add;
                } else {
                    newWord = entry.add + newWord;
                }
                
                newWords.push(newWord);
                
                // If there are continuation classes, recursively apply those rules
                if (entry.continuationClasses) {
                    for (let j = 0; j < entry.continuationClasses.length; j++) {
                        const continuationRule = this.rules[entry.continuationClasses[j]];
                        
                        if (continuationRule) {
                            newWords = newWords.concat(this._applyRule(newWord, continuationRule));
                        }
                    }
                }
            }
        }
        
        return newWords;
    }

    check(aWord) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}
		
		if (!aWord) {
			return false;
		}
//console.log("CHECK: "+this.dictionaryTable[aWord])

		// Remove leading and trailing whitespace
		var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		
		if (this.checkExact(trimmedWord)) {
			return true;
		}
//console.log("not in dictionary")
		// The exact word is not in the dictionary.
		if (trimmedWord.toUpperCase() === trimmedWord) {
			// The word was supplied in all uppercase.
			// Check for a capitalized form of the word.
			var capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();
			
			if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}
			
			if (this.checkExact(capitalizedWord)) {
				// The all-caps word is a capitalized word spelled correctly.
				return true;
			}

			if (this.checkExact(trimmedWord.toLowerCase())) {
				// The all-caps is a lowercase word spelled correctly.
				return true;
			}
		}
		
		var uncapitalizedWord = trimmedWord[0].toLowerCase() + trimmedWord.substring(1);
		
		if (uncapitalizedWord !== trimmedWord) {
			if (this.hasFlag(uncapitalizedWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}
			
			// Check for an uncapitalized form
			if (this.checkExact(uncapitalizedWord)) {
				// The word is spelled correctly but with the first letter capitalized.
				return true;
			}
		}
		
		return false;
	}

    checkExact(word) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		var ruleCodes = this.dictionaryTable[word];
//console.log("RULES: "+ruleCodes)
		var i, _len;

		if (typeof ruleCodes === 'undefined') {
			//return true;
            return false;
		}
		else if (ruleCodes === null) {
			// a null (but not undefined) value for an entry in the dictionary table
			// means that the word is in the dictionary but has no flags.
			return true;
		}
		else if (typeof ruleCodes === 'object') { // this.dictionary['hasOwnProperty'] will be a function.
			return true;
		}

		return false;
	}

    hasFlag(word, flag, wordFlags) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		if (flag in this.flags) {
			if (typeof wordFlags === 'undefined') {
				wordFlags = Array.prototype.concat.apply([], this.dictionaryTable[word]);
			}
			
			if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
				return true;
			}
		}
		
		return false;
	}

    suggest(word, limit=5) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		limit = limit || 5;

		if (this.memoized.hasOwnProperty(word)) {
			var memoizedLimit = this.memoized[word]['limit'];

			// Only return the cached list if it's big enough or if there weren't enough suggestions
			// to fill a smaller limit.
			if (limit <= memoizedLimit || this.memoized[word]['suggestions'].length < memoizedLimit) {
				return this.memoized[word]['suggestions'].slice(0, limit);
			}
		}
		
		//if (this.check(word)) return [];
        
		// Check the replacement table.
		for (var i = 0, _len = this.replacementTable.length; i < _len; i++) {
			var replacementEntry = this.replacementTable[i];
			//console.log("entry: "+replacementEntry)
			if (word.indexOf(replacementEntry[0]) !== -1) {
				var correctedWord = word.replace(replacementEntry[0], replacementEntry[1]);
				
				if (this.check(correctedWord)) {
					return [ correctedWord ];
				}
			}
		}
		
		if (!this.alphabet) {
			// Use the English alphabet as the default. Problematic, but backwards-compatible.
			this.alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
			
			// Any characters defined in the affix file as substitutions can go in the alphabet too.
			// Note that dictionaries do not include the entire alphabet in the TRY flag when it's there.
			// For example, Q is not in the default English TRY list; that's why having the default
			// alphabet above is useful.
			if ( 'TRY' in this.flags ) {
				this.alphabet += this.flags['TRY'];
			}
			
			// Plus any additional characters specifically defined as being allowed in words.
			if ( 'WORDCHARS' in this.flags ) {
				this.alphabet += this.flags['WORDCHARS'];
			}
			
			// Remove any duplicates.
			var alphaArray = this.alphabet.split("");
			alphaArray.sort();

			var alphaHash = {};
			for ( var i = 0; i < alphaArray.length; i++ ) {
				alphaHash[ alphaArray[i] ] = true;
			}
			
			this.alphabet = '';
			
			for ( var i in alphaHash ) {
				this.alphabet += i;
			}
		}

        //console.log(this.alphabet)
		//return ""
		var self = this;

		/**
		 * Returns a hash keyed by all of the strings that can be made by making a single edit to the word (or words in) `words`
		 * The value of each entry is the number of unique ways that the resulting word can be made.
		 *
		 * @arg mixed words Either a hash keyed by words or a string word to operate on.
		 * @arg bool known_only Whether this function should ignore strings that are not in the dictionary.
		 */
		function edits1(words, known_only) {
			var rv = {};
			
			var i, j, _iilen, _len, _jlen, _edit;

			var alphabetLength = self.alphabet.length;
			
			if (typeof words == 'string') {
				var word = words;
				words = {};
				words[word] = true;
			}
            
			for (var word in words) {
                
				for (i = 0, _len = word.length + 1; i < _len; i++) {
					var s = [ word.substring(0, i), word.substring(i) ];
				
					// Remove a letter.
					if (s[1]) {
						_edit = s[0] + s[1].substring(1);

						if (!known_only || self.check(_edit)) {
							if (!(_edit in rv)) {
								rv[_edit] = 1;
							}
							else {
								rv[_edit] += 1;
							}
						}
					}
					
					// Transpose letters
					// Eliminate transpositions of identical letters
					if (s[1].length > 1 && s[1][1] !== s[1][0]) {
						_edit = s[0] + s[1][1] + s[1][0] + s[1].substring(2);

						if (!known_only || self.check(_edit)) {
							if (!(_edit in rv)) {
								rv[_edit] = 1;
							}
							else {
								rv[_edit] += 1;
							}
						}
					}

					if (s[1]) {
						// Replace a letter with another letter.

						var lettercase = (s[1].substring(0,1).toUpperCase() === s[1].substring(0,1)) ? 'uppercase' : 'lowercase';

						for (j = 0; j < alphabetLength; j++) {
							var replacementLetter = self.alphabet[j];

							// Set the case of the replacement letter to the same as the letter being replaced.
							if ( 'uppercase' === lettercase ) {
								replacementLetter = replacementLetter.toUpperCase();
							}

							// Eliminate replacement of a letter by itself
							if (replacementLetter != s[1].substring(0,1)){
								_edit = s[0] + replacementLetter + s[1].substring(1);

								if (!known_only || self.check(_edit)) {
									if (!(_edit in rv)) {
										rv[_edit] = 1;
									}
									else {
										rv[_edit] += 1;
									}
								}
							}
						}
					}

					if (s[1]) {
						// Add a letter between each letter.
						for (j = 0; j < alphabetLength; j++) {
							// If the letters on each side are capitalized, capitalize the replacement.
							var lettercase = (s[0].substring(-1).toUpperCase() === s[0].substring(-1) && s[1].substring(0,1).toUpperCase() === s[1].substring(0,1)) ? 'uppercase' : 'lowercase';

							var replacementLetter = self.alphabet[j];

							if ( 'uppercase' === lettercase ) {
								replacementLetter = replacementLetter.toUpperCase();
							}

							_edit = s[0] + replacementLetter + s[1];

							if (!known_only || self.check(_edit)) {
								if (!(_edit in rv)) {
									rv[_edit] = 1;
								}
								else {
									rv[_edit] += 1;
								}
							}
						}
					}
				}
			}
			//console.log(rv)
			return rv;
		}

		function correct(word) {
			// Get the edit-distance-1 and edit-distance-2 forms of this word.
			var ed1 = edits1(word);
			var ed2 = edits1(ed1, true);

            //console.log("ed1: "+ed1)
            //console.log("ed2: "+ed2)
            //return ""
			
			// Sort the edits based on how many different ways they were created.
			var weighted_corrections = ed2;
			
			for (var ed1word in ed1) {
				if (!self.check(ed1word)) {
					continue;
				}

				if (ed1word in weighted_corrections) {
					weighted_corrections[ed1word] += ed1[ed1word];
				}
				else {
					weighted_corrections[ed1word] = ed1[ed1word];
				}
			}
			
			var i, _len;

			var sorted_corrections = [];
			
			for (i in weighted_corrections) {
				if (weighted_corrections.hasOwnProperty(i)) {
					sorted_corrections.push([ i, weighted_corrections[i] ]);
				}
			}

			function sorter(a, b) {
				var a_val = a[1];
				var b_val = b[1];
				if (a_val < b_val) {
					return -1;
				} else if (a_val > b_val) {
					return 1;
				}
				// @todo If a and b are equally weighted, add our own weight based on something like the key locations on this language's default keyboard.
				return b[0].localeCompare(a[0]);
			}
			
			sorted_corrections.sort(sorter).reverse();

			var rv = [];

			var capitalization_scheme = "lowercase";
			
			if (word.toUpperCase() === word) {
				capitalization_scheme = "uppercase";
			}
			else if (word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase() === word) {
				capitalization_scheme = "capitalized";
			}
			
			var working_limit = limit;

			for (i = 0; i < Math.min(working_limit, sorted_corrections.length); i++) {
				if ("uppercase" === capitalization_scheme) {
					sorted_corrections[i][0] = sorted_corrections[i][0].toUpperCase();
				}
				else if ("capitalized" === capitalization_scheme) {
					sorted_corrections[i][0] = sorted_corrections[i][0].substr(0, 1).toUpperCase() + sorted_corrections[i][0].substr(1);
				}
				
				if (!self.hasFlag(sorted_corrections[i][0], "NOSUGGEST") && rv.indexOf(sorted_corrections[i][0]) == -1) {
					rv.push(sorted_corrections[i][0]);
				}
				else {
					// If one of the corrections is not eligible as a suggestion , make sure we still return the right number of suggestions.
					working_limit++;
				}
			}

			return rv;
		}
		
		this.memoized[word] = {
			'suggestions': correct(word),
			'limit': limit
		};

		return this.memoized[word]['suggestions'];
	}
}