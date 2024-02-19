document.addEventListener('DOMContentLoaded', async () => {
    //const dictionaryName = "en_GB";
    const dictionaryName = "it_IT";
    const dictionaryPath = "dictionaries";
    const dictionary = new AsyncTypo(dictionaryName, dictionaryPath);
    let hovered_word;

    const textInput = document.getElementById('textInput');
    const suggestionsContainer = document.getElementById('suggestions');
    const textarea = document.getElementById('textInputSC');

    try {
        await dictionary.loadAsync();
        console.log('Dictionary loaded successfully.');

        textInput.addEventListener('keyup', function(event) {
            if (dictionary.loaded) {
                // Check if the key pressed is space or Enter
                if (event.key === ' ' || event.key === 'Enter') {
                    // Get the last word typed
                    const words = event.target.value.trim().split(/\s+/);
                    const lastWord = words[words.length - 1]; // Get the last word

                    //console.log(lastWord)
                    if (lastWord && dictionary.loaded) {
                        if (!dictionary.check(lastWord)) {
                            console.log('Word is not ok');
                            const suggestions = dictionary.suggest(lastWord);
                            suggestionsContainer.innerHTML = suggestions.length > 0 ? 'Suggestions: ' + suggestions.join(', ') : 'No suggestions found';
                            //suggestionsContainer.innerHTML = suggestions.length > 0 ? 'Suggestions: ' + suggestions.map(suggestion => `<span class="suggestion">${suggestion}</span>`).join('') : 'No suggestions found';
                        } else {
                            console.log('Word is ok');
                            suggestionsContainer.innerHTML = '';
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Failed to load the dictionary:', error);
    }

    textarea.addEventListener('mousedown', function(event) {
        const text = this.value;
        const wordBoundary = /\b\w+\b/g;
        const words = text.match(wordBoundary);

        const mouseX = event.clientX;
        const mouseY = event.clientY;

        const { top, left } = this.getBoundingClientRect();

        const relativeX = mouseX - left;
        const relativeY = mouseY - top;

        if (words) {
            const wordIndex = words.findIndex(word => {
                const start = text.indexOf(word);
                const end = start + word.length;
                const startPos = this.getBoundingClientRect().left + this.scrollLeft + this.value.substr(0, start).length * 8; // Assuming font width as 8px
                const endPos = startPos + word.length * 8; // Assuming font width as 8px
                return relativeX >= startPos && relativeX <= endPos;
            });

            if (wordIndex !== -1) {
                hovered_word=words[wordIndex]
                console.log('Hovered word:', hovered_word);

                if (dictionary.loaded) {
                    if (!dictionary.check(hovered_word)) {
                        console.log('Word is not ok');
                        const suggestions = dictionary.suggest(hovered_word);
                        //suggestionsContainer.innerHTML = suggestions.length > 0 ? 'Suggestions: ' + suggestions.join(', ') : 'No suggestions found';
                        suggestionsContainer.innerHTML = suggestions.length > 0 ? 'Suggestions: ' + suggestions.map(suggestion => `<span class="suggestion">${suggestion}</span>`).join(' ') : 'No suggestions found';
                    } else {
                        console.log('Word is ok');
                        suggestionsContainer.innerHTML = '';
                    }
                }

            }
        }
    });

    suggestionsContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('suggestion')) {
            const replacement = event.target.textContent;
            const currentText = textarea.value;
            const newText = currentText.replace(hovered_word, replacement);
            textarea.value = newText;
            suggestionsContainer.innerHTML = '';
            hovered_word="";
        }
    });
});