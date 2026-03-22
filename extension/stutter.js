// --- Stutter Engine ---
// Preprocesses text to simulate realistic speech disfluencies:
// syllable-onset repetitions, word repetitions, prolongations, blocks, interjections

const StutterEngine = (() => {
  const CONTINUANTS = new Set(['s','f','m','n','l','r','z','v','sh','th']);

  const DEFAULTS = {
    stutterRate: 0.22,
    maxRepetitions: 3,
    blockPauseMin: 200,
    blockPauseMax: 600,
    // Weights for disfluency type selection
    weights: {
      syllableRepeat: 40,
      wordRepeat: 20,
      prolongation: 20,
      block: 15,
      interjection: 5
    }
  };

  function getOnset(word) {
    const clean = word.replace(/^[^a-zA-Z]+/, '');
    const match = clean.match(/^([^aeiouAEIOU]*[aeiouAEIOU]?)/);
    if (!match || !match[1]) return clean[0] || '';
    let onset = match[1];
    // Remove the vowel to get pure consonant onset
    if (/[aeiouAEIOU]$/.test(onset) && onset.length > 1) {
      onset = onset.slice(0, -1);
    }
    return onset || clean[0] || '';
  }

  function isContinuant(word) {
    const clean = word.replace(/^[^a-zA-Z]+/, '').toLowerCase();
    if (CONTINUANTS.has(clean[0])) return true;
    if (clean.length >= 2 && CONTINUANTS.has(clean.slice(0, 2))) return true;
    return false;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [type, w] of entries) {
      r -= w;
      if (r <= 0) return type;
    }
    return entries[entries.length - 1][0];
  }

  function stutterify(text, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    if (options.weights) {
      opts.weights = { ...DEFAULTS.weights, ...options.weights };
    }

    const words = text.split(/(\s+)/); // preserve whitespace tokens
    const chunks = [];

    for (const token of words) {
      // Whitespace token — skip
      if (/^\s+$/.test(token)) {
        chunks.push({ text: token, pauseBefore: 0 });
        continue;
      }

      // Decide if this word gets a disfluency
      if (Math.random() > opts.stutterRate) {
        chunks.push({ text: token, pauseBefore: 0 });
        continue;
      }

      const type = weightedPick(opts.weights);
      const reps = randInt(2, opts.maxRepetitions);

      switch (type) {
        case 'syllableRepeat': {
          const onset = getOnset(token);
          if (onset) {
            const prefix = Array(reps).fill(onset).join('- ') + '- ';
            chunks.push({ text: prefix + token, pauseBefore: 0 });
          } else {
            chunks.push({ text: token, pauseBefore: 0 });
          }
          break;
        }

        case 'wordRepeat': {
          for (let i = 0; i < reps; i++) {
            chunks.push({ text: token + '...', pauseBefore: i === 0 ? 0 : 120 });
          }
          chunks.push({ text: token, pauseBefore: 100 });
          break;
        }

        case 'prolongation': {
          if (isContinuant(token)) {
            const clean = token.replace(/^[^a-zA-Z]+/, '');
            const leadPunct = token.slice(0, token.length - clean.length);
            // Check for digraph
            const digraph = clean.slice(0, 2).toLowerCase();
            let prolonged;
            if (CONTINUANTS.has(digraph)) {
              prolonged = leadPunct + clean[0] + clean[1] + clean[1].repeat(randInt(2, 4)) + clean.slice(2);
            } else {
              prolonged = leadPunct + clean[0] + clean[0].repeat(randInt(2, 4)) + clean.slice(1);
            }
            chunks.push({ text: prolonged, pauseBefore: 0 });
          } else {
            // Fallback to syllable repeat
            const onset = getOnset(token);
            const prefix = Array(reps).fill(onset).join('- ') + '- ';
            chunks.push({ text: prefix + token, pauseBefore: 0 });
          }
          break;
        }

        case 'block': {
          const pause = randInt(opts.blockPauseMin, opts.blockPauseMax);
          chunks.push({ text: token, pauseBefore: pause });
          break;
        }

        case 'interjection': {
          const filler = Math.random() < 0.5 ? 'um' : 'uh';
          chunks.push({ text: filler + ',', pauseBefore: 0 });
          chunks.push({ text: token, pauseBefore: 150 });
          break;
        }

        default:
          chunks.push({ text: token, pauseBefore: 0 });
      }
    }

    return chunks;
  }

  // Flatten chunks into a single string for API-based TTS.
  // Pauses become "..." in the text so the TTS engine pauses naturally.
  function flatten(chunks) {
    let result = '';
    for (const chunk of chunks) {
      if (chunk.pauseBefore > 0) {
        result += '... ';
      }
      result += chunk.text;
    }
    return result;
  }

  // Map intensity (0-100) to stutterRate
  function intensityToRate(intensity) {
    return 0.05 + (intensity / 100) * 0.40; // 5% to 45%
  }

  return { stutterify, flatten, intensityToRate, DEFAULTS };
})();
