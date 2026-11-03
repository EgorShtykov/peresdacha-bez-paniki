import { tasks, type Task } from '@/data/tasks'

export const PRACTICE_LEVELS = [
  { id: 'base', label: 'База', description: 'Прямое применение метода' },
  { id: 'retake', label: 'Пересдача', description: 'Другие числа и конструкция' },
  { id: 'challenge', label: 'Усложнение', description: 'Больше вычислений и внимания к знакам' },
] as const

export type PracticeLevel = (typeof PRACTICE_LEVELS)[number]['id']

export type GraphSpec = {
  points: [number, number][]
}

export type GeneratedTask = Task & {
  sourceId: string
  level: PracticeLevel
  seed: number
  graphSpec?: GraphSpec
}

type Rng = {
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

type Draft = Omit<Task, 'id' | 'variant' | 'number' | 'topic'>

type Generator = (rng: Rng, level: PracticeLevel, source: Task, seed: number) => GeneratedTask

function makeRng(key: string): Rng {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  let state = hash >>> 0
  const next = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return {
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min
    },
    pick<T>(items: readonly T[]) {
      return items[Math.floor(next() * items.length)]
    },
  }
}

function build(source: Task, level: PracticeLevel, seed: number, draft: Draft): GeneratedTask {
  return {
    id: `generated-${source.id}-${level}-${seed}`,
    variant: source.variant,
    number: source.number,
    topic: source.topic,
    sourceId: source.id,
    level,
    seed,
    ...draft,
  }
}

const levelIndex = (level: PracticeLevel) => PRACTICE_LEVELS.findIndex((item) => item.id === level)
const signed = (value: number) => value < 0 ? `- ${Math.abs(value)}` : `+ ${value}`
const linear = (slope: number, shift: number, variable = 'x') => `${slope === 1 ? '' : slope === -1 ? '-' : slope}${variable} ${signed(shift)}`
const answerText = (value: number | string) => ({ answer: `${value}`, accepted: [`${value}`] })

function linearTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, reverse = false) {
  const li = levelIndex(level)
  let a = rng.int(2 + li, 4 + li * 2)
  let b = rng.int(2 + li, 5 + li * 2)
  if (a === b) a += 1
  const root = rng.int(-5 - li, 4 + li)
  const c = rng.int(-12 - li * 3, 12 + li * 3)
  const d = (b - a) * root + c
  const prompt = reverse
    ? `\frac{x ${signed(c)}}{${b}}=\frac{x ${signed(d)}}{${a}}`
    : `${a}(x ${signed(c)})=${b}x ${signed(d)}`
  const constant = reverse ? a * c - b * d : a * c - d
  const coefficient = reverse ? a - b : a - b
  const actualRoot = reverse ? -constant / coefficient : root
  const numericRoot = Number.isInteger(actualRoot) ? `${actualRoot}` : actualRoot.toFixed(3)
  return build(source, level, seed, {
    title: 'Решите уравнение.',
    prompt,
    answer: numericRoot,
    accepted: [numericRoot, numericRoot.replace('.', ',')],
    answerFormat: 'Одно число. Десятичную дробь можно записать через запятую.',
    hint: 'Раскрой скобки или умножь обе части на произведение знаменателей, затем перенеси слагаемые с x в одну сторону.',
    steps: reverse ? [
      { text: 'Умножим обе части на произведение знаменателей.', math: `${a}(x ${signed(c)})=${b}(x ${signed(d)})` },
      { text: 'Раскроем скобки.', math: `${a}x ${signed(a * c)}=${b}x ${signed(b * d)}` },
      { text: 'Перенесём неизвестные влево и найдём x.', math: `${a - b}x=${b * d - a * c},\quad x=${numericRoot}` },
    ] : [
      { text: 'Раскроем скобки в левой части.', math: `${a}x ${signed(a * c)}=${b}x ${signed(d)}` },
      { text: 'Перенесём слагаемые с x влево, числа — вправо.', math: `${a - b}x=${d - a * c}` },
      { text: 'Разделим на коэффициент при x.', math: `x=${numericRoot}` },
    ],
    mistake: 'При переносе слагаемых забывают сменить знак или не умножают на число каждый член в скобках.',
  })
}

function quadraticTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, complete = false) {
  const li = levelIndex(level)
  let p = rng.int(1 + li, 4 + li * 2)
  let q = rng.int(1 + li, 4 + li * 2)
  if (p === q) q += 1
  if (p > q) [p, q] = [q, p]
  const a = rng.int(1, 2 + li)
  const b = a * (p + q)
  const c = a * p * q
  const answer = `-${q}; -${p}`
  const latexRoots = `x_1=-${q},\quad x_2=-${p}`
  if (complete) {
    return build(source, level, seed, {
      title: 'Решите уравнение. Если корней несколько, запишите их через точку с запятой.',
      prompt: `${a === 1 ? '' : a}x^2 ${signed(b)}x ${signed(c)}=0`,
      answer,
      accepted: [answer, `-${p}; -${q}`, `-${q};-${p}`, `-${p};-${q}`],
      answerFormat: 'Два корня через точку с запятой, сначала больший по модулю отрицательный корень.',
      hint: 'Это полный квадратный трёхчлен. Можно использовать теорему Виета: сумма корней отрицательна, произведение положительно.',
      steps: [
        { text: 'Запишем сумму и произведение корней по теореме Виета.', math: `x_1+x_2=-${p + q},\qquad x_1x_2=${p * q}` },
        { text: 'Подходящая пара отрицательных чисел:', math: latexRoots },
      ],
      mistake: 'У корней неверно выбирают знаки: здесь произведение положительно, а сумма отрицательна, поэтому оба корня отрицательны.',
    })
  }
  return build(source, level, seed, {
    title: 'Найдите корень уравнения. Если корней несколько, запишите меньший из них.',
    prompt: `x^2 ${signed(-a * (p + q))}x ${signed(a * p * q)}=0`,
    answer: `${p}`,
    accepted: [`${p}`],
    answerFormat: 'Одно число — меньший из двух корней.',
    hint: 'Разложи трёхчлен на множители или используй теорему Виета, затем сравни корни.',
    steps: [
      { text: 'Сумма корней и произведение:', math: `x_1+x_2=${p + q},\qquad x_1x_2=${p * q}` },
      { text: 'Получаем корни и выбираем меньший.', math: `x_1=${p},\quad x_2=${q},\qquad \min=${p}` },
    ],
    mistake: 'После нахождения двух корней записывают больший, хотя в условии просят меньший.',
  })
}

function incompleteQuadratic(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const a = rng.int(2, 5 + levelIndex(level) * 2)
  const root = rng.int(2, 7 + levelIndex(level) * 2)
  return build(source, level, seed, {
    title: 'Найдите корень уравнения. Если корней несколько, запишите больший из них.',
    prompt: `${a}x^2=${a * root ** 2}`,
    answer: `${root}`,
    accepted: [`${root}`],
    answerFormat: 'Одно число — больший корень.',
    hint: 'Раздели на коэффициент при x² и извлеки квадратный корень, не забыв отрицательный корень.',
    steps: [
      { text: 'Разделим обе части на коэффициент.', math: `x^2=${root ** 2}` },
      { text: 'Получаем два корня и выбираем больший.', math: `x=\pm ${root},\qquad x_{\max}=${root}` },
    ],
    mistake: 'Записывают только положительный корень, не проверив, какой именно корень требуется в условии.',
  })
}

function factoredQuadratic(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const li = levelIndex(level)
  const r1 = rng.int(-7 - li, -1)
  const r2 = rng.int(2, 8 + li)
  const factor = (root: number) => `(x ${signed(-root)})`
  return build(source, level, seed, {
    title: 'Найдите корень уравнения. Если корней несколько, запишите меньший из них.',
    prompt: `${factor(r1)}${factor(r2)}=0`,
    answer: `${r1}`,
    accepted: [`${r1}`],
    answerFormat: 'Одно число — меньший корень.',
    hint: 'Произведение равно нулю, когда хотя бы один множитель равен нулю. Приравняй каждую скобку к нулю.',
    steps: [
      { text: 'Приравняем каждый множитель к нулю.', math: `x ${signed(-r1)}=0\quad\text{или}\quad x ${signed(-r2)}=0` },
      { text: 'Корни уравнения:', math: `x_1=${r1},\quad x_2=${r2},\qquad x_{\min}=${r1}` },
    ],
    mistake: 'Из уравнения x + a = 0 получают x = a вместо x = −a.',
  })
}

function derivativePolynomial(source: Task, level: PracticeLevel, seed: number, rng: Rng, withTangent = false) {
  const li = levelIndex(level)
  const a = rng.int(2, 5 + li)
  const b = rng.int(3, 8 + li * 2)
  const c = rng.int(1, 6 + li)
  const point = rng.int(-3 - li, 3 + li)
  const derivative = 3 * a * point ** 2 + 2 * b * point + c
  const value = a * point ** 3 + b * point ** 2 + c * point
  if (withTangent) {
    return build(source, level, seed, {
      title: 'Прямая касается графика функции. Найдите абсциссу точки касания.',
      prompt: `y=${derivative}x ${signed(value - derivative * point)},\qquad f(x)=${a}x^3+${b}x^2+${c}x`,
      answer: `${point}`,
      accepted: [`${point}`],
      answerFormat: 'Одно число — абсцисса x₀.',
      hint: 'Угловой коэффициент касательной равен производной в точке касания. Реши f′(x) = k.',
      steps: [
        { text: 'Найдём производную функции.', math: `f'(x)=${3 * a}x^2+${2 * b}x+${c}` },
        { text: 'Приравняем её к угловому коэффициенту касательной.', math: `${3 * a}x^2+${2 * b}x+${c}=${derivative}` },
        { text: 'Из условия касания и расположения графика получаем единственную точку.', math: `x_0=${point}` },
      ],
      mistake: 'Ищут ординату или приравнивают к нулю саму функцию вместо производной.',
    })
  }
  return build(source, level, seed, {
    title: 'Найдите производную функции в точке x₀.',
    prompt: `f(x)=${a}x^3+${b}x^2+${c}x,\qquad x_0=${point}`,
    answer: `${derivative}`,
    accepted: [`${derivative}`],
    answerFormat: 'Одно число.',
    hint: 'Сначала найди f′(x), затем подставь x₀. Не подставляй точку до дифференцирования.',
    steps: [
      { text: 'Дифференцируем каждое слагаемое.', math: `f'(x)=${3 * a}x^2+${2 * b}x+${c}` },
      { text: 'Подставляем точку.', math: `f'(${point})=${derivative}` },
    ],
    mistake: 'Теряют множитель степени: производная x³ равна 3x², а не x².',
  })
}

function tangentLine(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const li = levelIndex(level)
  const a = rng.int(1, 3 + li)
  const b = rng.int(2, 7 + li)
  const x0 = rng.int(1, 4 + li)
  const y0 = a * x0 ** 2 - b * x0
  const k = 2 * a * x0 - b
  const intercept = y0 - k * x0
  return build(source, level, seed, {
    title: 'Найдите угловой коэффициент касательной к графику функции в точке x₀.',
    prompt: `f(x)=${a}x^2-${b}x,\qquad x_0=${x0}`,
    answer: `${k}`,
    accepted: [`${k}`],
    answerFormat: 'Одно число.',
    hint: 'Угловой коэффициент касательной k = f′(x₀).',
    steps: [
      { text: 'Найдём производную.', math: `f'(x)=${2 * a}x-${b}` },
      { text: 'Подставим абсциссу точки касания.', math: `k=f'(${x0})=${k}` },
    ],
    mistake: `Путают значение функции и производной. В этой задаче f(x₀)=${y0}, а k=${k}; свободный член касательной равен ${intercept}.`,
  })
}

function exponentTask(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.pick([2, 3, 5])
  const a = rng.int(1, 3 + levelIndex(level))
  const b = rng.int(1, 4)
  const c = rng.int(1, 5)
  const d = a + b * c
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\frac{${base}^{${d}}}{${base}^{${a}}\cdot ${base}^{${c}}}`,
    ...answerText(base ** b),
    answerFormat: 'Одно целое число.',
    hint: 'В знаменателе показатели складываются, при делении степеней с одинаковым основанием — вычитаются.',
    steps: [
      { text: 'Упростим произведение в знаменателе.', math: `${base}^{${a}}\cdot ${base}^{${c}}=${base}^{${a + c}}` },
      { text: 'Выполним деление степеней.', math: `${base}^{${d}-${a + c}}=${base}^{${b}}=${base ** b}` },
    ],
    mistake: 'При умножении степеней перемножают показатели вместо того, чтобы сложить их.',
  })
}

function radicalQuotient(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const li = levelIndex(level)
  const inner = rng.int(2, 5 + li)
  const n = rng.int(3, 8 + li * 2)
  const value = n * inner ** 2
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\frac{\sqrt{${n ** 2}\cdot ${inner ** 4}}}{${n}}`,
    ...answerText(value),
    answerFormat: 'Одно целое число.',
    hint: 'Вынеси полные квадраты из-под корня, затем сократи дробь.',
    steps: [
      { text: 'Представим подкоренное выражение как квадрат.', math: `${n ** 2}\cdot ${inner ** 4}=(${n * inner ** 2})^2` },
      { text: 'Извлечём корень и сократим.', math: `\frac{${n * inner ** 2}}{${n}}=${value}` },
    ],
    mistake: 'Извлекают корень из каждого слагаемого, хотя под корнем произведение, или забывают второй множитель.',
  })
}

function radicalHypotenuse(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const pairs = rng.pick([
    [3, 4],
    [6, 8],
    [5, 12],
    [8, 15],
    [9, 12],
  ] as const)
  const [a, b] = pairs
  const c = Math.sqrt(a * a + b * b)
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\sqrt{${a ** 2}+${b ** 2}}`,
    ...answerText(c),
    answerFormat: 'Одно целое число.',
    hint: 'Сначала вычисли сумму квадратов под корнем, затем извлеки корень.',
    steps: [
      { text: 'Возведём каждое число в квадрат и сложим.', math: `${a ** 2}+${b ** 2}=${c ** 2}` },
      { text: 'Извлечём арифметический квадратный корень.', math: `\sqrt{${c ** 2}}=${c}` },
    ],
    mistake: 'Складывают числа до возведения в квадрат: √(a²+b²) не равно a+b.',
  })
}

function logProduct(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.pick([2, 3, 5])
  const m = rng.int(2, 4 + levelIndex(level))
  const n = rng.int(2, 4 + levelIndex(level))
  const a = base ** m
  const b = base ** n
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\log_{${base}} ${a}+\log_{${base}} ${b}`,
    ...answerText(m + n),
    answerFormat: 'Одно целое число.',
    hint: 'Сумма логарифмов с одинаковым основанием равна логарифму произведения.',
    steps: [
      { text: 'Объединим логарифмы.', math: `\log_{${base}}(${a}\cdot ${b})=\log_{${base}} ${a * b}` },
      { text: 'Представим произведение как степень основания.', math: `${a * b}=${base}^{${m + n}},\qquad \log_{${base}} ${base}^{${m + n}}=${m + n}` },
    ],
    mistake: 'Складывают сами числа под логарифмами вместо их перемножения.',
  })
}

function logLinearEquation(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.pick([2, 3, 4, 5])
  const power = rng.int(2, 3 + levelIndex(level))
  const rhs = base ** power
  const shift = rng.int(1, 6 + levelIndex(level))
  const root = rhs - shift
  return build(source, level, seed, {
    title: 'Найдите корень уравнения.',
    prompt: `\log_{${base}}(x ${signed(shift)})=${power}`,
    ...answerText(root),
    answerFormat: 'Одно число.',
    hint: 'По определению логарифма выражение под логарифмом равно основанию в показателе справа.',
    steps: [
      { text: 'Перейдём от логарифмического уравнения к линейному.', math: `x ${signed(shift)}=${base}^{${power}}=${rhs}` },
      { text: 'Решим уравнение и проверим область допустимых значений.', math: `x=${root},\qquad x ${signed(shift)}=${rhs}>0` },
    ],
    mistake: 'Возводят в степень основание, но затем неверно переносят слагаемое из-под логарифма.',
  })
}

function logFractionEquation(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.pick([2, 3, 5])
  const power = rng.int(1, 2 + levelIndex(level))
  const rhs = base ** power
  const shift = rng.int(1, 5)
  const root = rhs + shift
  return build(source, level, seed, {
    title: 'Найдите корень уравнения.',
    prompt: `\log_{${base}}(x-${shift})=${power}`,
    ...answerText(root),
    answerFormat: 'Одно число.',
    hint: 'Основание логарифма возведи в степень, стоящую справа, и приравняй к выражению под логарифмом.',
    steps: [
      { text: 'Используем определение логарифма.', math: `x-${shift}=${base}^{${power}}=${rhs}` },
      { text: 'Найдём x и проверим условие x − сдвиг > 0.', math: `x=${root},\qquad ${root}-${shift}=${rhs}>0` },
    ],
    mistake: 'Теряют знак при переносе вычитаемого числа в правую часть.',
  })
}

function trigValue(source: Task, level: PracticeLevel, seed: number, rng: Rng, cosine = false) {
  const angle = rng.pick(level === 'base' ? [30, 45, 60] : [30, 45, 60, 120, 135, 150])
  const radians: Record<number, string> = { 30: '\frac{\pi}{6}', 45: '\frac{\pi}{4}', 60: '\frac{\pi}{3}', 120: '\frac{2\pi}{3}', 135: '\frac{3\pi}{4}', 150: '\frac{5\pi}{6}' }
  const values: Record<string, Record<number, string>> = {
    sin: { 30: '0,5', 45: '\frac{\sqrt2}{2}', 60: '\frac{\sqrt3}{2}', 120: '\frac{\sqrt3}{2}', 135: '\frac{\sqrt2}{2}', 150: '0,5' },
    cos: { 30: '\frac{\sqrt3}{2}', 45: '\frac{\sqrt2}{2}', 60: '0,5', 120: '-0,5', 135: '-\frac{\sqrt2}{2}', 150: '-\frac{\sqrt3}{2}' },
  }
  const name = cosine ? 'cos' : 'sin'
  const value = values[name][angle]
  const accepted = value === '0,5' ? ['0,5', '0.5'] : value === '-0,5' ? ['-0,5', '-0.5'] : cosine && angle === 45 ? ['sqrt2/2', 'sqrt(2)/2', '0,707', '0.707'] : ['sqrt2/2', 'sqrt(2)/2', '0,707', '0.707']
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\${name} ${radians[angle]}`,
    answer: value,
    accepted,
    answerFormat: value.includes('sqrt') || value.includes('\frac') ? 'Точное значение: корень из 2, делённый на 2, можно записать как sqrt2/2.' : 'Десятичную дробь можно записать через запятую.',
    hint: 'Переведи радианы в градусы и используй таблицу значений тригонометрических функций.',
    steps: [
      { text: 'Переведём угол в градусы.', math: `${radians[angle]}=${angle}^{\circ}` },
      { text: 'Подставим табличное значение.', math: `\${name} ${angle}^{\circ}=${value}` },
    ],
    mistake: 'Путают значения синуса и косинуса или знак во второй четверти.',
  })
}

function trigIdentity(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const angle = rng.pick([30, 45, 60])
  const multiplier = rng.int(2, 5 + levelIndex(level))
  const sine = angle === 30 ? '\frac12' : angle === 45 ? '\frac{\sqrt2}{2}' : '\frac{\sqrt3}{2}'
  const cosine = angle === 30 ? '\frac{\sqrt3}{2}' : angle === 45 ? '\frac{\sqrt2}{2}' : '\frac12'
  const tan = angle === 30 ? '\frac{\sqrt3}{3}' : angle === 45 ? '1' : '\sqrt3'
  const value = angle === 45 ? `${multiplier}` : angle === 30 ? `${multiplier}\cdot\frac{\sqrt3}{3}` : `${multiplier}\sqrt3`
  const accepted = angle === 45 ? [`${multiplier}`] : angle === 30 ? [`${multiplier}sqrt3/3`, `${multiplier}/sqrt3`] : [`${multiplier}sqrt3`]
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `${multiplier}\operatorname{tg}${angle}^{\circ}`,
    answer: value,
    accepted,
    answerFormat: 'Точное выражение. Корень записывай как sqrt3; умножение можно не ставить.',
    hint: 'Тангенс — это отношение синуса к косинусу. Используй табличный угол.',
    steps: [
      { text: 'Запишем синус и косинус угла.', math: `\sin ${angle}^{\circ}=${sine},\qquad \cos ${angle}^{\circ}=${cosine}` },
      { text: 'Разделим синус на косинус и умножим на коэффициент.', math: `${multiplier}\operatorname{tg}${angle}^{\circ}=${multiplier}\cdot ${tan}=${value}` },
    ],
    mistake: 'Путают тангенс с котангенсом или неверно сокращают корни.',
  })
}

function powersFraction(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.pick([2, 3, 4])
  const p = rng.int(2, 4 + levelIndex(level))
  const q = rng.int(2, 4 + levelIndex(level))
  const r = rng.int(1, 3 + levelIndex(level))
  const resultPower = p + q - r
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `\frac{${base}^{${p}}\cdot ${base}^{${q}}}{${base}^{${r}}}`,
    ...answerText(base ** resultPower),
    answerFormat: 'Одно целое число.',
    hint: 'Сложи показатели в числителе и вычти показатель знаменателя.',
    steps: [
      { text: 'Упростим показатель всей дроби.', math: `${base}^{${p}+${q}-${r}}=${base}^{${resultPower}}` },
      { text: 'Возведём основание в полученную степень.', math: `${base}^{${resultPower}}=${base ** resultPower}` },
    ],
    mistake: 'Вычисляют каждую степень отдельно и допускают арифметическую ошибку вместо сокращения показателей.',
  })
}

function numericRootPower(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const base = rng.int(2, 5 + levelIndex(level))
  const square = rng.int(2, 7 + levelIndex(level))
  return build(source, level, seed, {
    title: 'Найдите значение выражения.',
    prompt: `(\sqrt{${square ** 2}}-${base})^{2}`,
    ...answerText((square - base) ** 2),
    answerFormat: 'Одно целое число.',
    hint: 'Сначала извлеки корень, затем вычти и только после этого возведи разность в квадрат.',
    steps: [
      { text: 'Упростим корень.', math: `\sqrt{${square ** 2}}=${square}` },
      { text: 'Вычислим разность и квадрат.', math: `(${square}-${base})^2=${(square - base) ** 2}` },
    ],
    mistake: 'Возводят в квадрат каждое слагаемое отдельно: (a−b)² не равно a²−b².',
  })
}

function graphExtremum(source: Task, level: PracticeLevel, seed: number, rng: Rng, maximum: boolean) {
  const li = levelIndex(level)
  const left = rng.int(-7 - li, -5)
  const right = rng.int(5, 8 + li)
  const vertex = rng.int(left + 2, right - 2)
  const height = rng.int(3, 6 + li)
  const width = Math.max(right - vertex, vertex - left)
  const shape = maximum ? -1 : 1
  const baseY = maximum ? rng.int(-2, 1) : rng.int(1, 5)
  const y = (x: number) => baseY + shape * height * (1 - ((x - vertex) / width) ** 2)
  const points = Array.from({ length: right - left + 1 }, (_, index) => {
    const x = left + index
    return [x, Number(y(x).toFixed(2))] as [number, number]
  })
  return build(source, level, seed, {
    title: `По графику функции найдите абсциссу точки ${maximum ? 'максимума' : 'минимума'}.`,
    prompt: `y=f(x),\qquad x\in[${left};${right}]`,
    ...answerText(vertex),
    answerFormat: 'Одно число — абсцисса вершины.',
    hint: `${maximum ? 'Максимум' : 'Минимум'} на этом графике находится в вершине. Нужна координата x, а не значение y.`,
    graphSpec: { points },
    steps: [
      { text: `Найдём самую ${maximum ? 'высокую' : 'низкую'} точку графика.`, math: `x_{\text{вершины}}=${vertex}` },
      { text: 'Записываем именно абсциссу.', math: `x_0=${vertex}` },
    ],
    mistake: 'Записывают ординату вершины или крайнюю точку отрезка вместо локального экстремума.',
  })
}

function graphIntervals(source: Task, level: PracticeLevel, seed: number, rng: Rng, derivative: boolean) {
  const li = levelIndex(level)
  const x1 = rng.int(-4 - li, -2)
  const x2 = rng.int(1, 3 + li)
  const left = x1 - rng.int(2, 3)
  const right = x2 + rng.int(2, 3)
  const sign = rng.pick([1, -1])
  const y = (x: number) => Number((sign * (x - x1) * (x - x2) / 3).toFixed(2))
  const points = Array.from({ length: right - left + 1 }, (_, index) => {
    const x = left + index
    return [x, y(x)] as [number, number]
  })
  const answer = `${x1}; ${x2}`
  return build(source, level, seed, {
    title: derivative ? 'По графику производной найдите абсциссы точек, в которых производная равна нулю.' : 'По графику функции найдите абсциссы точек экстремума.',
    prompt: derivative ? `y=f'(x),\qquad x\in[${left};${right}]` : `y=f(x),\qquad x\in[${left};${right}]`,
    answer,
    accepted: [answer, `${x1};${x2}`, `${x2}; ${x1}`, `${x2};${x1}`],
    answerFormat: 'Две абсциссы через точку с запятой, в порядке возрастания.',
    hint: derivative ? 'Нужны нули графика производной — пересечения с осью Ox.' : 'Ищи смену возрастания на убывание или наоборот.',
    graphSpec: { points },
    steps: [
      { text: derivative ? 'Отметим пересечения графика с осью абсцисс.' : 'Отметим вершины, где меняется монотонность.', math: `x_1=${x1},\qquad x_2=${x2}` },
      { text: 'Запишем абсциссы в порядке возрастания.', math: answer.replace(';', ';\quad') },
    ],
    mistake: derivative ? 'Берут экстремумы самой производной, хотя нужны её нули.' : 'Читают ординаты точек вместо абсцисс.',
  })
}

function graphSymmetry(source: Task, level: PracticeLevel, seed: number, rng: Rng, kind: 'even' | 'odd' | 'none') {
  const pointsCount = 3 + levelIndex(level)
  const positive = Array.from({ length: pointsCount }, (_, index) => {
    const x = index + 1
    const y = rng.int(-3, 5)
    return [x, y] as [number, number]
  })
  let points: [number, number][]
  if (kind === 'even') {
    points = [...positive.map(([x, y]) => [-x, y] as [number, number]).reverse(), [0, rng.int(-2, 4)], ...positive]
  } else if (kind === 'odd') {
    points = [...positive.map(([x, y]) => [-x, -y] as [number, number]).reverse(), [0, 0], ...positive]
  } else {
    const negative = positive.map(([x], index) => [-x, rng.int(-3, 5) + (index === 0 ? 1 : 0)] as [number, number]).reverse()
    points = [...negative, [0, rng.int(-2, 4)], ...positive]
  }
  const answer = kind === 'even' ? 'чётная' : kind === 'odd' ? 'нечётная' : 'ни чётная, ни нечётная'
  return build(source, level, seed, {
    title: 'По графику определите вид функции.',
    prompt: `y=f(x)`,
    answer,
    accepted: kind === 'none' ? ['ни чётная ни нечётная', 'ничётнаянинечётная', 'ни четная ни нечетная', 'общего вида'] : [answer],
    answerFormat: 'Запиши: чётная, нечётная или ни чётная, ни нечётная.',
    hint: 'Чётный график симметричен относительно оси Oy, нечётный — относительно начала координат.',
    graphSpec: { points },
    steps: [
      { text: 'Сравним значения в противоположных точках x и −x.', math: kind === 'even' ? 'f(-x)=f(x)' : kind === 'odd' ? 'f(-x)=-f(x)' : 'f(-x)\ne f(x),\quad f(-x)\ne -f(x)' },
      { text: 'Сделаем вывод по симметрии.', math: `\text{${answer}}` },
    ],
    mistake: 'Проверяют симметрию только по внешнему виду одной ветви, не сравнивая точки с противоположными абсциссами.',
  })
}

function pointsMonotonicity(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const li = levelIndex(level)
  const x1 = rng.int(-4 - li, -2)
  const x2 = rng.int(1, 3 + li)
  const points = Array.from({ length: 7 + li * 2 }, (_, index) => {
    const x = x1 - 2 + index
    const y = Number(((x - x1) * (x - x2) / 4).toFixed(2))
    return [x, y] as [number, number]
  })
  const vertex = (x1 + x2) / 2
  const count = points.filter(([x]) => x < vertex).length
  return build(source, level, seed, {
    title: 'По графику функции укажите количество целых точек промежутка убывания.',
    prompt: `y=f(x)`,
    ...answerText(count),
    answerFormat: 'Одно целое число — количество точек.',
    hint: 'Сначала найди промежуток убывания, затем посчитай только целые абсциссы внутри него.',
    graphSpec: { points },
    steps: [
      { text: 'Функция убывает слева от вершины.', math: `x<${vertex}` },
      { text: 'Считаем целые абсциссы в отображённой части этого промежутка.', math: `N=${count}` },
    ],
    mistake: 'Считают все отмеченные точки графика, а не только те, где функция убывает.',
  })
}

function geometryTriangle(source: Task, level: PracticeLevel, seed: number, rng: Rng, hypotenuse = false) {
  const [a, b] = rng.pick([[3, 4], [6, 8], [5, 12], [9, 12], [8, 15]] as const)
  const c = Math.sqrt(a * a + b * b)
  const multiplier = rng.int(1, 2 + levelIndex(level))
  const legA = a * multiplier
  const legB = b * multiplier
  const hyp = c * multiplier
  const answer = hypotenuse ? hyp : legA
  return build(source, level, seed, {
    title: hypotenuse ? 'В прямоугольном треугольнике катеты равны указанным значениям. Найдите гипотенузу.' : 'В прямоугольном треугольнике известны гипотенуза и катет. Найдите другой катет.',
    prompt: hypotenuse ? `a=${legA},\qquad b=${legB}` : `c=${hyp},\qquad b=${legB}`,
    ...answerText(answer),
    answerFormat: 'Одно число.',
    hint: 'Используй теорему Пифагора: сумма квадратов катетов равна квадрату гипотенузы.',
    steps: [
      { text: 'Запишем теорему Пифагора.', math: 'a^2+b^2=c^2' },
      { text: 'Подставим известные стороны.', math: hypotenuse ? `c=\sqrt{${legA}^2+${legB}^2}=${hyp}` : `a=\sqrt{${hyp}^2-${legB}^2}=${legA}` },
    ],
    mistake: 'При поиске катета складывают квадраты вместо вычитания квадрата известного катета из квадрата гипотенузы.',
  })
}

function circleTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, area = false) {
  const radius = rng.int(2, 8 + levelIndex(level) * 2)
  return build(source, level, seed, {
    title: area ? 'Найдите площадь круга, радиус которого дан. Ответ запишите с множителем π.' : 'Найдите длину окружности заданного радиуса. Ответ запишите с множителем π.',
    prompt: `R=${radius}`,
    answer: area ? `${radius ** 2}\pi` : `${2 * radius}\pi`,
    accepted: area ? [`${radius ** 2}pi`, `pi${radius ** 2}`] : [`${2 * radius}pi`, `pi${2 * radius}`],
    answerFormat: 'Произведение числа и π, например 12pi.',
    hint: area ? 'Формула площади круга: S = πR².' : 'Формула длины окружности: C = 2πR.',
    steps: [
      { text: 'Подставим радиус в формулу.', math: area ? `S=\pi\cdot ${radius}^2=${radius ** 2}\pi` : `C=2\pi\cdot ${radius}=${2 * radius}\pi` },
    ],
    mistake: 'Путают радиус и диаметр или возводят в квадрат вместе с радиусом множитель π при вычислении длины.',
  })
}

function trapezoidTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, perimeter = false) {
  const li = levelIndex(level)
  const top = rng.int(3, 7 + li)
  const extra = rng.pick([2, 4, 6])
  const bottom = top + extra * 2
  const leg = Math.sqrt(extra ** 2 + (extra + 3) ** 2)
  const height = extra + 3
  if (perimeter) {
    const value = Math.round((top + bottom + 2 * leg) * 100) / 100
    return build(source, level, seed, {
      title: 'В равнобедренной трапеции известны основания и высота. Найдите периметр, округлив до сотых.',
      prompt: `a=${bottom},\quad b=${top},\quad h=${height}`,
      answer: `${value}`.replace('.', ','),
      accepted: [`${value}`, `${value}`.replace('.', ',')],
      answerFormat: 'Число, округлённое до сотых; запятую можно заменить точкой.',
      hint: 'Разность оснований делится поровну на два горизонтальных отрезка. Боковую сторону найди по теореме Пифагора.',
      steps: [
        { text: 'Найдём горизонтальный катет и боковую сторону.', math: `x=\frac{${bottom}-${top}}2=${extra},\qquad l=\sqrt{${extra}^2+${height}^2}\approx${leg.toFixed(2)}` },
        { text: 'Сложим все четыре стороны.', math: `P=${bottom}+${top}+2l\approx${value}` },
      ],
      mistake: 'Используют всю разность оснований как горизонтальный катет вместо её половины.',
    })
  }
  return build(source, level, seed, {
    title: 'В равнобедренной трапеции известны основания и боковая сторона. Найдите высоту.',
    prompt: `a=${bottom},\quad b=${top},\quad l=${Math.round(leg * 100) / 100}`,
    answer: `${height}`,
    accepted: [`${height}`],
    answerFormat: 'Одно число.',
    hint: 'Опусти две высоты. Каждый маленький горизонтальный отрезок равен полуразности оснований.',
    steps: [
      { text: 'Найдём горизонтальный катет.', math: `x=\frac{${bottom}-${top}}2=${extra}` },
      { text: 'По теореме Пифагора найдём высоту.', math: `h=\sqrt{l^2-x^2}=${height}` },
    ],
    mistake: 'Вычитают основания без деления на два и получают неверный горизонтальный катет.',
  })
}

function rectangleTask(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const a = rng.int(3, 9 + levelIndex(level))
  const b = rng.int(3, 9 + levelIndex(level))
  const area = a * b
  const perimeter = 2 * (a + b)
  const askArea = rng.pick([true, false])
  return build(source, level, seed, {
    title: askArea ? 'Стороны прямоугольника даны. Найдите его площадь.' : 'Стороны прямоугольника даны. Найдите его периметр.',
    prompt: `a=${a},\qquad b=${b}`,
    ...answerText(askArea ? area : perimeter),
    answerFormat: 'Одно число.',
    hint: askArea ? 'Площадь прямоугольника равна произведению соседних сторон.' : 'Периметр — сумма всех сторон: P = 2(a+b).',
    steps: [
      { text: 'Подставим стороны в нужную формулу.', math: askArea ? `S=${a}\cdot ${b}=${area}` : `P=2(${a}+${b})=${perimeter}` },
    ],
    mistake: 'Путают формулы площади и периметра или складывают только две стороны при поиске периметра.',
  })
}

function stereometryBox(source: Task, level: PracticeLevel, seed: number, rng: Rng, diagonal = false) {
  const li = levelIndex(level)
  const a = rng.int(2, 6 + li)
  const b = rng.int(2, 6 + li)
  const c = rng.int(2, 6 + li)
  if (diagonal) {
    const value = Math.round(Math.sqrt(a * a + b * b + c * c) * 100) / 100
    return build(source, level, seed, {
      title: 'Даны три ребра прямоугольного параллелепипеда. Найдите диагональ, округлив до сотых.',
      prompt: `a=${a},\quad b=${b},\quad c=${c}`,
      answer: `${value}`.replace('.', ','),
      accepted: [`${value}`, `${value}`.replace('.', ',')],
      answerFormat: 'Число до сотых; можно использовать запятую или точку.',
      hint: 'Квадрат пространственной диагонали равен сумме квадратов трёх измерений.',
      steps: [
        { text: 'Применим формулу диагонали.', math: `d=\sqrt{${a}^2+${b}^2+${c}^2}=\sqrt{${a * a + b * b + c * c}}` },
        { text: 'Округлим до сотых.', math: `d\approx${value}` },
      ],
      mistake: 'Складывают рёбра вместо суммы их квадратов.',
    })
  }
  return build(source, level, seed, {
    title: 'Даны три ребра прямоугольного параллелепипеда. Найдите его объём.',
    prompt: `a=${a},\quad b=${b},\quad c=${c}`,
    ...answerText(a * b * c),
    answerFormat: 'Одно целое число.',
    hint: 'Объём прямоугольного параллелепипеда равен произведению трёх измерений.',
    steps: [
      { text: 'Перемножим длину, ширину и высоту.', math: `V=${a}\cdot ${b}\cdot ${c}=${a * b * c}` },
    ],
    mistake: 'Складывают измерения или находят площадь только одной грани.',
  })
}

function pyramidTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, surface = false) {
  const side = rng.int(3, 8 + levelIndex(level))
  const height = rng.int(3, 8 + levelIndex(level))
  if (surface) {
    const slant = Math.sqrt(height ** 2 + (side / 2) ** 2)
    const value = Math.round((side ** 2 + 2 * side * slant) * 100) / 100
    return build(source, level, seed, {
      title: 'В правильной четырёхугольной пирамиде даны сторона основания и высота. Найдите площадь полной поверхности, округлив до сотых.',
      prompt: `a=${side},\qquad h=${height}`,
      answer: `${value}`.replace('.', ','),
      accepted: [`${value}`, `${value}`.replace('.', ',')],
      answerFormat: 'Число до сотых; можно использовать запятую или точку.',
      hint: 'Сначала найди апофему по высоте и половине стороны основания, затем сложи площадь основания и четырёх граней.',
      steps: [
        { text: 'Найдём апофему.', math: `l=\sqrt{${height}^2+(${side}/2)^2}\approx${slant.toFixed(2)}` },
        { text: 'Вычислим полную поверхность.', math: `S=${side}^2+2\cdot${side}l\approx${value}` },
      ],
      mistake: 'Используют высоту пирамиды как высоту боковой грани: для площади граней нужна апофема.',
    })
  }
  return build(source, level, seed, {
    title: 'В правильной четырёхугольной пирамиде даны сторона основания и высота. Найдите объём.',
    prompt: `a=${side},\qquad h=${height}`,
    ...answerText(side ** 2 * height / 3),
    answerFormat: 'Одно число; дробь можно записать через запятую.',
    hint: 'Объём пирамиды равен одной трети произведения площади основания на высоту.',
    steps: [
      { text: 'Найдём площадь квадратного основания.', math: `S=${side}^2=${side ** 2}` },
      { text: 'Умножим на высоту и разделим на три.', math: `V=\frac13\cdot ${side ** 2}\cdot ${height}=${side ** 2 * height / 3}` },
    ],
    mistake: 'Забывают множитель 1/3 и вычисляют объём как у призмы.',
  })
}

function cylinderTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, surface = false) {
  const radius = rng.int(2, 6 + levelIndex(level))
  const height = rng.int(3, 9 + levelIndex(level))
  if (surface) {
    const coefficient = 2 * radius * height + 2 * radius ** 2
    return build(source, level, seed, {
      title: 'Даны радиус и высота цилиндра. Найдите площадь полной поверхности с множителем π.',
      prompt: `R=${radius},\qquad h=${height}`,
      answer: `${coefficient}\pi`,
      accepted: [`${coefficient}pi`, `pi${coefficient}`],
      answerFormat: 'Число и pi без пробела, например 48pi.',
      hint: 'Полная поверхность состоит из боковой поверхности 2πRh и двух оснований 2πR².',
      steps: [
        { text: 'Сложим боковую поверхность и основания.', math: `S=2\pi\cdot${radius}\cdot${height}+2\pi\cdot${radius}^2=${coefficient}\pi` },
      ],
      mistake: 'Учитывают только одно основание или забывают боковую поверхность.',
    })
  }
  return build(source, level, seed, {
    title: 'Даны радиус и высота цилиндра. Найдите объём с множителем π.',
    prompt: `R=${radius},\qquad h=${height}`,
    answer: `${radius ** 2 * height}\pi`,
    accepted: [`${radius ** 2 * height}pi`, `pi${radius ** 2 * height}`],
    answerFormat: 'Число и pi без пробела, например 72pi.',
    hint: 'Объём цилиндра равен площади круга в основании, умноженной на высоту.',
    steps: [
      { text: 'Подставим значения в формулу V = πR²h.', math: `V=\pi\cdot${radius}^2\cdot${height}=${radius ** 2 * height}\pi` },
    ],
    mistake: 'Не возводят радиус в квадрат или используют диаметр вместо радиуса.',
  })
}

function probabilityTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, atLeast = false) {
  const li = levelIndex(level)
  const red = rng.int(2, 5 + li)
  const blue = rng.int(2, 5 + li)
  const green = rng.int(1, 4 + li)
  const total = red + blue + green
  if (atLeast) {
    const favorable = red + blue
    const value = Math.round(favorable / total * 1000) / 1000
    return build(source, level, seed, {
      title: 'В коробке лежат красные, синие и зелёные шары. Наугад берут один шар. Найдите вероятность того, что он не зелёный.',
      prompt: `\text{Красных: }${red},\quad \text{синих: }${blue},\quad \text{зелёных: }${green}`,
      answer: `${value}`.replace('.', ','),
      accepted: [`${value}`, `${value}`.replace('.', ','), `${favorable}/${total}`],
      answerFormat: 'Десятичная дробь или обыкновенная дробь, например 0,75.',
      hint: 'Событие «не зелёный» означает красный или синий. Сложи благоприятные исходы и раздели на общее число.',
      steps: [
        { text: 'Найдём общее число шаров и благоприятных исходов.', math: `N=${total},\qquad M=${red}+${blue}=${favorable}` },
        { text: 'Разделим благоприятные исходы на все исходы.', math: `P=\frac{${favorable}}{${total}}=${value}` },
      ],
      mistake: 'Считают вероятность зелёного шара, хотя требуется противоположное событие.',
    })
  }
  const value = Math.round(red / total * 1000) / 1000
  return build(source, level, seed, {
    title: 'В коробке лежат красные, синие и зелёные шары. Наугад берут один шар. Найдите вероятность того, что он красный.',
    prompt: `\text{Красных: }${red},\quad \text{синих: }${blue},\quad \text{зелёных: }${green}`,
    answer: `${value}`.replace('.', ','),
    accepted: [`${value}`, `${value}`.replace('.', ','), `${red}/${total}`],
    answerFormat: 'Десятичная дробь или обыкновенная дробь, например 0,4.',
    hint: 'Классическая вероятность: число красных шаров раздели на общее число шаров.',
    steps: [
      { text: 'Найдём общее число равновозможных исходов.', math: `N=${red}+${blue}+${green}=${total}` },
      { text: 'Подставим благоприятные исходы в формулу.', math: `P=\frac{${red}}{${total}}=${value}` },
    ],
    mistake: 'Делят на число только двух цветов или складывают вероятности без необходимости.',
  })
}

function statisticsTask(source: Task, level: PracticeLevel, seed: number, rng: Rng, median = false) {
  const li = levelIndex(level)
  const count = median ? 5 + li * 2 : 4 + li
  const start = rng.int(2, 8)
  const step = rng.int(1, 4)
  const values = Array.from({ length: count }, (_, index) => start + index * step)
  if (median) {
    const middle = values[Math.floor(count / 2)]
    return build(source, level, seed, {
      title: 'Найдите медиану упорядоченного ряда чисел.',
      prompt: values.join(';\quad'),
      ...answerText(middle),
      answerFormat: 'Одно число.',
      hint: 'Ряд уже упорядочен. Для нечётного числа значений медиана — центральный элемент.',
      steps: [
        { text: 'Определим номер центрального элемента.', math: `N=${count},\qquad k=\frac{${count}+1}{2}=${(count + 1) / 2}` },
        { text: 'Выберем элемент с этим номером.', math: `Me=${middle}` },
      ],
      mistake: 'Находят среднее арифметическое вместо центрального элемента упорядоченного ряда.',
    })
  }
  const sum = values.reduce((acc, value) => acc + value, 0)
  return build(source, level, seed, {
    title: 'Найдите среднее арифметическое ряда чисел.',
    prompt: values.join(';\quad'),
    ...answerText(sum / count),
    answerFormat: 'Одно число; дробную часть можно отделить запятой.',
    hint: 'Сложи все значения и раздели сумму на их количество.',
    steps: [
      { text: 'Найдём сумму значений.', math: values.join('+') + `=${sum}` },
      { text: 'Разделим на количество значений.', math: `\bar{x}=\frac{${sum}}{${count}}=${sum / count}` },
    ],
    mistake: 'Делят сумму не на количество всех значений, а на количество промежутков между ними.',
  })
}

function parameterTask(source: Task, level: PracticeLevel, seed: number, rng: Rng) {
  const li = levelIndex(level)
  const a = rng.int(2, 4 + li)
  const b = rng.int(1, 5 + li)
  const c = rng.int(1, 5 + li)
  const root = rng.int(-3, 5)
  const parameter = a * root + b
  return build(source, level, seed, {
    title: 'Найдите значение параметра a, при котором данное число является корнем уравнения.',
    prompt: `${a === 1 ? '' : a}x+${b}=a,\qquad x=${root}`,
    ...answerText(parameter),
    answerFormat: 'Одно число — значение параметра a.',
    hint: 'Подставь указанный корень вместо x и реши полученное уравнение относительно a.',
    steps: [
      { text: 'Подставим корень.', math: `${a}\cdot(${root})+${b}=a` },
      { text: 'Выразим параметр.', math: `a=${a * root + b}` },
    ],
    mistake: 'Подставляют значение параметра вместо x или неверно переносят слагаемые при решении относительно a.',
  })
}

const generators: Record<string, Generator> = {
  'v1-01': (rng, level, source, seed) => linearTask(source, level, seed, rng),
  'v1-02': (rng, level, source, seed) => quadraticTask(source, level, seed, rng),
  'v1-03': (rng, level, source, seed) => incompleteQuadratic(source, level, seed, rng),
  'v1-04': (rng, level, source, seed) => factoredQuadratic(source, level, seed, rng),
  'v1-05': (rng, level, source, seed) => derivativePolynomial(source, level, seed, rng),
  'v1-06': (rng, level, source, seed) => tangentLine(source, level, seed, rng),
  'v1-07': (rng, level, source, seed) => exponentTask(source, level, seed, rng),
  'v1-08': (rng, level, source, seed) => radicalQuotient(source, level, seed, rng),
  'v1-09': (rng, level, source, seed) => logProduct(source, level, seed, rng),
  'v1-10': (rng, level, source, seed) => graphExtremum(source, level, seed, rng, true),
  'v1-11': (rng, level, source, seed) => graphIntervals(source, level, seed, rng, false),
  'v1-12': (rng, level, source, seed) => graphSymmetry(source, level, seed, rng, rng.pick(['even', 'odd', 'none'] as const)),
  'v1-13': (rng, level, source, seed) => geometryTriangle(source, level, seed, rng, true),
  'v1-14': (rng, level, source, seed) => circleTask(source, level, seed, rng, false),
  'v1-15': (rng, level, source, seed) => trapezoidTask(source, level, seed, rng, false),
  'v1-16': (rng, level, source, seed) => parameterTask(source, level, seed, rng),
  'v1-17': (rng, level, source, seed) => stereometryBox(source, level, seed, rng, false),
  'v1-18': (rng, level, source, seed) => pyramidTask(source, level, seed, rng, false),
  'v1-19': (rng, level, source, seed) => probabilityTask(source, level, seed, rng, false),
  'v1-20': (rng, level, source, seed) => statisticsTask(source, level, seed, rng, false),
  'v2-01': (rng, level, source, seed) => linearTask(source, level, seed, rng, true),
  'v2-02': (rng, level, source, seed) => quadraticTask(source, level, seed, rng, true),
  'v2-03': (rng, level, source, seed) => incompleteQuadratic(source, level, seed, rng),
  'v2-04': (rng, level, source, seed) => factoredQuadratic(source, level, seed, rng),
  'v2-05': (rng, level, source, seed) => derivativePolynomial(source, level, seed, rng, true),
  'v2-06': (rng, level, source, seed) => tangentLine(source, level, seed, rng),
  'v2-07': (rng, level, source, seed) => powersFraction(source, level, seed, rng),
  'v2-08': (rng, level, source, seed) => numericRootPower(source, level, seed, rng),
  'v2-09': (rng, level, source, seed) => logLinearEquation(source, level, seed, rng),
  'v2-10': (rng, level, source, seed) => graphExtremum(source, level, seed, rng, false),
  'v2-11': (rng, level, source, seed) => graphIntervals(source, level, seed, rng, true),
  'v2-12': (rng, level, source, seed) => graphSymmetry(source, level, seed, rng, 'odd'),
  'v2-13': (rng, level, source, seed) => geometryTriangle(source, level, seed, rng, false),
  'v2-14': (rng, level, source, seed) => circleTask(source, level, seed, rng, true),
  'v2-15': (rng, level, source, seed) => trapezoidTask(source, level, seed, rng, true),
  'v2-16': (rng, level, source, seed) => parameterTask(source, level, seed, rng),
  'v2-17': (rng, level, source, seed) => stereometryBox(source, level, seed, rng, true),
  'v2-18': (rng, level, source, seed) => pyramidTask(source, level, seed, rng, true),
  'v2-19': (rng, level, source, seed) => probabilityTask(source, level, seed, rng, true),
  'v2-20': (rng, level, source, seed) => statisticsTask(source, level, seed, rng, true),
}

export function generatePracticeTask(sourceId: string, level: PracticeLevel, seed: number): GeneratedTask {
  const source = tasks.find((task) => task.id === sourceId) ?? tasks[0]
  const generator = generators[source.id]
  if (!generator) throw new Error(`Нет генератора для ${source.id}`)
  const safeSeed = Math.max(1, Math.abs(Math.floor(seed)) || 1)
  return generator(makeRng(`${source.id}:${level}:${safeSeed}`), level, source, safeSeed)
}
