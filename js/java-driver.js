/* ══════════════════════════════════════════════════════════════════════
   java-driver.js ─ Turns the test input box into a Java main().
   Mirrors buildDriver() in parser.js. The input format is identical to
   the Python side because it is LeetCode's own format, which is the
   whole point of "paste it exactly as given".
   ══════════════════════════════════════════════════════════════════════ */

/* The solution method: its name, return type, and parameter types.
   Prefers a public method, since that is what LeetCode always marks. */
function javaSignature(src){
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const re = /(?:public|protected)\s+(?:static\s+)?([\w.$]+(?:\s*<[^>]*>)?(?:\s*\[\s*\])*)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while((m = re.exec(body)) !== null){
    if(m[2] === 'main') continue;
    const params = m[3].trim()
      ? m[3].split(',').map(p => {
          const parts = p.trim().split(/\s+/);
          return { type: parts.slice(0, -1).join(' ').replace(/\s+/g,''),
                   name: parts[parts.length - 1] };
        })
      : [];
    return { returnType: m[1].replace(/\s+/g,''), method: m[2], params };
  }
  return null;
}

/* Render a JS value as a Java literal of the declared type. */
function javaLiteral(type, value){
  const t = String(type).replace(/\s+/g, '');

  if(t === 'char[][]' || t === 'String[][]'){
    const wrap = t === 'char[][]' ? c => "'" + c + "'" : s => JSON.stringify(s);
    return '{' + value.map(row => '{' + row.map(wrap).join(',') + '}').join(',') + '}';
  }
  if(t === 'int[][]' || t === 'long[][]' || t === 'double[][]' || t === 'boolean[][]')
    return '{' + value.map(r => '{' + r.join(',') + '}').join(',') + '}';

  if(t === 'char[]')    return '{' + value.map(c => "'" + c + "'").join(',') + '}';
  if(t === 'String[]')  return '{' + value.map(s => JSON.stringify(s)).join(',') + '}';
  if(t === 'int[]' || t === 'long[]' || t === 'double[]' || t === 'boolean[]')
    return '{' + value.join(',') + '}';

  if(t === 'String')  return JSON.stringify(value);
  if(t === 'char')    return "'" + value + "'";
  if(t === 'boolean') return String(value);
  if(t === 'int' || t === 'long' || t === 'double' || t === 'float') return String(value);

  if(t === 'ListNode') return '__H.buildList(new int[]{' + value.join(',') + '})';
  if(t === 'TreeNode') return '__H.buildTree(new Integer[]{' +
    value.map(v => v === null ? 'null' : v).join(',') + '})';

  // List<Integer>, List<String>, List<List<Integer>>
  if(/^List</.test(t)){
    const inner = t.slice(5, -1);
    const one = v => /^List</.test(inner)
      ? 'Arrays.asList(' + v.map(x => typeof x === 'string' ? JSON.stringify(x) : x).join(',') + ')'
      : (typeof v === 'string' ? JSON.stringify(v) : String(v));
    return 'new ArrayList<>(Arrays.asList(' + value.map(one).join(',') + '))';
  }

  return JSON.stringify(value);
}

/* Array types get `Type name = {…};`, everything else `Type name = expr;`. */
function javaDecl(type, name, value){
  const lit = javaLiteral(type, value);
  return `    ${type} ${name} = ${lit};`;
}

function buildJavaDriver(userCode, inputText){
  const sig = javaSignature(userCode);
  if(!sig)
    return { driver:null, error:'Could not find a public method in your Solution class.' };

  const vals = {};
  for(const line of String(inputText).split('\n')){
    const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*,?\s*$/);
    if(!m) continue;
    let raw = m[2];
    try { vals[m[1]] = JSON.parse(raw); }
    catch(e){
      try { vals[m[1]] = JSON.parse(raw.replace(/'/g, '"')); }
      catch(e2){ vals[m[1]] = raw.replace(/^["']|["']$/g, ''); }
    }
  }

  const decls = [];
  for(const p of sig.params){
    if(!(p.name in vals))
      return { driver:null,
               error:`Test input is missing a value for "${p.name}". ` +
                     `Expected a line like:  ${p.name} = ...` };
    decls.push(javaDecl(p.type, p.name, vals[p.name]));
  }

  const args = sig.params.map(p => p.name).join(', ');
  const call = `new Solution().${sig.method}(${args})`;
  const body = sig.returnType === 'void'
    ? `    ${call};\n    System.out.println("__RESULT{null}");`
    : `    ${sig.returnType} __r = ${call};\n` +
      `    System.out.println("__RESULT{" + __Tracer.serResult(__r) + "}");`;

  return { driver: decls.join('\n') + '\n' + body, error:null };
}
