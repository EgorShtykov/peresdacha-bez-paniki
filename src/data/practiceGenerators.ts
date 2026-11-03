import { tasks, type Task } from './tasks'

export const PRACTICE_LEVELS = [
  { id: 'base', label: 'База', description: 'Прямое применение метода' },
  { id: 'retake', label: 'Пересдача', description: 'Другие числа и конструкция' },
  { id: 'challenge', label: 'Усложнение', description: 'Больше вычислений и внимания к знакам' },
] as const

export type PracticeLevel = (typeof PRACTICE_LEVELS)[number]['id']
export type GraphSpec = { points: [number, number][] }
export type GeneratedTask = Task & {
  sourceId: string
  level: PracticeLevel
  seed: number
  graphSpec?: GraphSpec
}

type Rng = () => number
type Draft = Pick<Task, 'prompt' | 'accepted' | 'answer' | 'placeholder' | 'hint' | 'steps' | 'mistake'> &
  Partial<Pick<Task, 'math' | 'graph'>> & { graphSpec?: GraphSpec }
type Generator = (rng: Rng, level: PracticeLevel, source: Task, seed: number) => GeneratedTask

const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const pick = <T,>(rng: Rng, values: readonly T[]) => values[int(rng, 0, values.length - 1)]
const decimal = (value: number, digits = 6) => String(Number(value.toFixed(digits)))
const tex = (value: number) => decimal(value).replace('.', '{,}')
const absTex = (value: number) => tex(Math.abs(value))
const signed = (value: number, suffix = '') => `${value < 0 ? '-' : '+'}${absTex(value)}${suffix}`
const numeric = (value: number) => [decimal(value)]

function makeRng(key: string): Rng {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
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

function combination(n: number, k: number) {
  let result = 1
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index
  return Math.round(result)
}

function radicalHypotenuse(length: number, angle: 30 | 45 | 60, ratio: 'sin' | 'cos') {
  if (angle === 45) {
    return {
      answer: `${length}\\sqrt2`,
      accepted: [`${length}sqrt2`, `${length}√2`],
      exact: `${length}sqrt2`,
    }
  }
  if ((angle === 30 && ratio === 'sin') || (angle === 60 && ratio === 'cos')) {
    return { answer: `${2 * length}`, accepted: [String(2 * length)], exact: String(2 * length) }
  }
  return {
    answer: `\\frac{2\\cdot${length}\\sqrt3}{3}`,
    accepted: [`${2 * length}sqrt3/3`, `2*${length}/sqrt3`, `${2 * length}/sqrt3`],
    exact: `${2 * length}sqrt3/3`,
  }
}

const generators: Record<string, Generator> = {
  'v1-01': (rng, level, source, seed) => {
    const max = level === 'base' ? 7 : level === 'retake' ? 12 : 18
    const a = int(rng, 2, max)
    let b = int(rng, 2, max)
    while (b === a) b = int(rng, 2, max)
    const answer = a + b
    return build(source, level, seed, {
      prompt: 'Является ли целым число, заданное выражением? Если да, запишите его.',
      math: `(\\sqrt{${a}}-\\sqrt{${b}})^2+2\\sqrt{${a * b}}`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите число',
      hint: 'Раскройте квадрат разности. Корни в удвоенном произведении сократятся.',
      steps: [
        { text: 'Раскрываем квадрат разности.', math: `(\\sqrt{${a}}-\\sqrt{${b}})^2=${a}-2\\sqrt{${a * b}}+${b}` },
        { text: 'Складываем с последним слагаемым.', math: `${a}-2\\sqrt{${a * b}}+${b}+2\\sqrt{${a * b}}=${answer}` },
      ],
      mistake: 'В квадрате разности есть удвоенное произведение −2ab; именно оно сокращается со вторым слагаемым.',
    })
  },
  'v1-02': (rng, level, source, seed) => {
    const degree = level === 'base' ? 3 : level === 'retake' ? 5 : 7
    const base = int(rng, 2, level === 'challenge' ? 4 : 3)
    const answer = -(base ** 2)
    const radicand = -(base ** (2 * degree))
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `\\sqrt[${degree}]{${radicand}}`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите число',
      hint: `Под корнем стоит −(${base}²) в степени ${degree}. Корень нечётной степени сохраняет знак.`,
      steps: [
        { text: 'Представляем подкоренное число как степень.', math: `${radicand}=-(${base}^2)^{${degree}}` },
        { text: 'Извлекаем корень нечётной степени.', math: `\\sqrt[${degree}]{-(${base}^2)^{${degree}}}=-${base}^2=${answer}` },
      ],
      mistake: 'Не отбрасывайте минус: корень нечётной степени из отрицательного числа существует.',
    })
  },
  'v1-03': (rng, level, source, seed) => {
    const base = int(rng, 2, level === 'base' ? 5 : 9)
    const q = int(rng, 3, level === 'challenge' ? 9 : 7)
    const p = int(rng, 1, q - 2)
    const r = q - p
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `${base}^{-${p}/${q}}\\cdot\\left(\\frac1{${base}}\\right)^{${r}/${q}}`,
      accepted: [`1/${base}`, decimal(1 / base)], answer: `\\frac1{${base}}`, placeholder: 'Дробь или десятичное число',
      hint: `Замените 1/${base} на ${base}⁻¹, а затем сложите показатели.`,
      steps: [
        { text: 'Приводим оба множителя к одному основанию.', math: `${base}^{-${p}/${q}}\\cdot(${base}^{-1})^{${r}/${q}}=${base}^{-${p}/${q}}\\cdot${base}^{-${r}/${q}}` },
        { text: 'Складываем показатели.', math: `${base}^{-(${p}+${r})/${q}}=${base}^{-1}=\\frac1{${base}}` },
      ],
      mistake: 'При умножении степеней с одинаковым основанием показатели складываются, а не перемножаются.',
    })
  },
  'v1-04': (rng, level, source, seed) => {
    const pairs: readonly (readonly [number, number])[] = level === 'base' ? [[2, 5], [5, 2]] as const
      : level === 'retake' ? [[4, 25], [5, 20], [10, 10]] as const
        : [[8, 125], [20, 50], [25, 40]] as const
    const [a, b] = pick(rng, pairs)
    const answer = Math.log10(a * b)
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `\\lg${a}+\\lg${b}`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите число',
      hint: 'Сумма логарифмов равна логарифму произведения.',
      steps: [
        { text: 'Объединяем логарифмы.', math: `\\lg${a}+\\lg${b}=\\lg(${a}\\cdot${b})=\\lg${a * b}` },
        { text: 'Используем определение десятичного логарифма.', math: `\\lg${a * b}=${answer}` },
      ],
      mistake: 'Логарифмы складываются через произведение аргументов, а не через их сумму.',
    })
  },
  'v1-05': (rng, level, source, seed) => {
    const angle = pick(rng, level === 'base' ? [4, 6] : level === 'retake' ? [3, 4] : [3, 4, 6])
    const sine = angle === 6 ? '\\frac12' : angle === 4 ? '\\frac{\\sqrt2}2' : '\\frac{\\sqrt3}2'
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `\\arcsin\\left(-${sine}\\right)+\\frac\\pi${angle}`,
      accepted: ['0'], answer: '0', placeholder: 'Введите число',
      hint: `Арксинус здесь равен −π/${angle}: значение arcsin лежит в [−π/2; π/2].`,
      steps: [
        { text: 'Определяем значение арксинуса.', math: `\\arcsin\\left(-${sine}\\right)=-\\frac\\pi${angle}` },
        { text: 'Складываем противоположные углы.', math: `-\\frac\\pi${angle}+\\frac\\pi${angle}=0` },
      ],
      mistake: 'У arcsin отрицательного значения результат отрицательный, а не положительный угол.',
    })
  },
  'v1-06': (rng, level, source, seed) => {
    const n = int(rng, level === 'base' ? 6 : level === 'retake' ? 10 : 15, level === 'base' ? 10 : level === 'retake' ? 15 : 20)
    const k = Math.min(int(rng, level === 'base' ? 2 : 3, level === 'challenge' ? 6 : 4), n - 2)
    const answer = combination(n, k)
    return build(source, level, seed, {
      prompt: `Сколько разных наборов можно составить, выбирая ${k} предметов из ${n}? Порядок не важен.`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите число наборов',
      hint: 'Порядок не важен, поэтому используйте сочетания, а не размещения.',
      steps: [
        { text: 'Записываем формулу сочетаний.', math: `C_{${n}}^{${k}}=\\frac{${n}!}{${k}!(${n}-${k})!}` },
        { text: 'Сокращаем факториалы и вычисляем.', math: `C_{${n}}^{${k}}=${answer}` },
      ],
      mistake: 'Размещения учитывают порядок и посчитают один и тот же набор несколько раз.',
    })
  },
  'v1-07': (rng, level, source, seed) => {
    const bound = level === 'base' ? 3 : level === 'retake' ? 5 : 7
    const coordinates = Array.from({ length: 6 }, () => int(rng, -bound, bound)) as number[]
    const [ax, ay, az, bx, by, bz] = coordinates
    const m = int(rng, 2, level === 'challenge' ? 4 : 3)
    const n = int(rng, 2, level === 'challenge' ? 4 : 3)
    const result = [m * ax - n * bx, m * ay - n * by, m * az - n * bz]
    const tuple = `(${result.join(';')})`
    return build(source, level, seed, {
      prompt: `Найдите координаты вектора ${m}a − ${n}b, если a{${ax}; ${ay}; ${az}}, b{${bx}; ${by}; ${bz}}.`,
      math: `${m}\\vec a-${n}\\vec b`, accepted: [tuple, result.join(';')], answer: tuple,
      placeholder: 'Например: (1; 4; −5)', hint: 'Сначала умножьте каждую координату на её коэффициент, затем вычитайте покоординатно.',
      steps: [
        { text: 'Умножаем векторы на числа.', math: `${m}\\vec a=(${m * ax};${m * ay};${m * az}),\\qquad ${n}\\vec b=(${n * bx};${n * by};${n * bz})` },
        { text: 'Вычитаем соответствующие координаты.', math: `${m}\\vec a-${n}\\vec b=${tuple}` },
      ],
      mistake: 'При вычитании меняются знаки всех координат второго вектора, а не только первой.',
    })
  },
  'v1-08': (rng, level, source, seed) => {
    const angle = pick(rng, level === 'base' ? [45] as const : level === 'retake' ? [30, 45] as const : [30, 45, 60] as const)
    const length = int(rng, 2, level === 'challenge' ? 12 : 8)
    const result = radicalHypotenuse(length, angle, 'sin')
    return build(source, level, seed, {
      prompt: `Прямая пересекает плоскость в точке C под углом ${angle}°. AB — перпендикуляр к плоскости, AB = ${length}. Найдите AC.`,
      math: `\\angle ACB=${angle}^\\circ,\\quad AB=${length}`, accepted: result.accepted, answer: result.answer,
      placeholder: 'Например: 6sqrt(2)', hint: 'AB — противолежащий катет. Используйте синус угла между прямой и плоскостью.',
      steps: [
        { text: 'Записываем синус через гипотенузу AC.', math: `\\sin${angle}^\\circ=\\frac{AB}{AC}=\\frac{${length}}{AC}` },
        { text: 'Выражаем гипотенузу.', math: `AC=\\frac{${length}}{\\sin${angle}^\\circ}=${result.answer}` },
      ],
      mistake: 'AC — гипотенуза: делим известный катет на синус, а не умножаем на него.',
    })
  },
  'v1-09': (rng, level, source, seed) => {
    const n = int(rng, level === 'base' ? 3 : 4, level === 'challenge' ? 9 : 7)
    const area = int(rng, 2, level === 'challenge' ? 18 : 10)
    const answer = n * area
    return build(source, level, seed, {
      prompt: `Площадь боковой грани правильной ${n}-угольной пирамиды равна ${area} ед². Найдите площадь боковой поверхности.`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите площадь',
      hint: `У правильной пирамиды ${n} равных боковых граней.`,
      steps: [
        { text: 'Все боковые грани правильной пирамиды равны.', math: `S_{\\text{бок}}=${n}\\cdot S_{\\text{грани}}` },
        { text: 'Подставляем площадь одной грани.', math: `S_{\\text{бок}}=${n}\\cdot${area}=${answer}\\text{ ед}^2` },
      ],
      mistake: 'Основание не входит в боковую поверхность; умножаем площадь грани на число сторон основания.',
    })
  },
  'v1-13': (rng, level, source, seed) => {
    const denominator = pick(rng, level === 'base' ? [6] : level === 'retake' ? [3, 4] : [3, 4, 6])
    const sign = level === 'challenge' && rng() > 0.5 ? -1 : 1
    const coefficient = int(rng, 1, level === 'base' ? 2 : 4)
    const sine = denominator === 6 ? '\\frac12' : denominator === 4 ? '\\frac{\\sqrt2}2' : '\\frac{\\sqrt3}2'
    const first = sign === 1 ? `\\frac\\pi${denominator}` : `-\\frac\\pi${denominator}`
    const second = sign === 1 ? `\\frac{${denominator - 1}\\pi}${denominator}` : `\\frac{${denominator + 1}\\pi}${denominator}`
    const firstText = sign === 1 ? `pi/${denominator}` : `-pi/${denominator}`
    const secondText = sign === 1 ? `${denominator - 1}pi/${denominator}` : `${denominator + 1}pi/${denominator}`
    const rhs = sign === 1 ? `${coefficient}\\cdot${sine}` : `-${coefficient}\\cdot${sine}`
    return build(source, level, seed, {
      prompt: 'Решите уравнение.', math: `${coefficient}\\sin x=${rhs}`,
      accepted: [`${firstText}+2pin;${secondText}+2pin`, `${secondText}+2pin;${firstText}+2pin`, `x=${firstText}+2pin;x=${secondText}+2pin`],
      answer: `x=${first}+2\\pi n;\\quad x=${second}+2\\pi n,\\ n\\in\\mathbb Z`,
      placeholder: 'Используйте pi и n', hint: 'Разделите на коэффициент и найдите обе точки окружности с нужным синусом.',
      steps: [
        { text: 'Делим обе части на коэффициент.', math: `\\sin x=${sign === 1 ? '' : '-'}${sine}` },
        { text: 'Записываем две серии решений и период синуса.', math: `x=${first}+2\\pi n\\quad\\text{или}\\quad x=${second}+2\\pi n` },
      ],
      mistake: 'На одном периоде обычно две точки с заданным синусом. Не потеряйте вторую серию и 2πn.',
    })
  },
  'v1-14': (rng, level, source, seed) => {
    const shift = int(rng, level === 'base' ? 1 : 0, level === 'challenge' ? 14 : 9)
    const base = int(rng, 2, 9)
    const excluded = shift + 1
    const interval = `(${shift};${excluded})u(${excluded};inf)`
    return build(source, level, seed, {
      prompt: 'Найдите область определения функции.', math: `y=\\frac1{\\log_${base}(x-${shift})}`,
      accepted: [interval, `(${shift};${excluded})∪(${excluded};+inf)`, `x>${shift};x!=${excluded}`],
      answer: `(${shift};${excluded})\\cup(${excluded};+\\infty)`, placeholder: 'Используйте U и inf',
      hint: 'Аргумент логарифма должен быть положительным, а сам логарифм в знаменателе — ненулевым.',
      steps: [
        { text: 'Находим условие для аргумента.', math: `x-${shift}>0\\Rightarrow x>${shift}` },
        { text: 'Исключаем нуль знаменателя.', math: `\\log_${base}(x-${shift})\\ne0\\Rightarrow x-${shift}\\ne1\\Rightarrow x\\ne${excluded}` },
        { text: 'Пересекаем условия.', math: `D(y)=(${shift};${excluded})\\cup(${excluded};+\\infty)` },
      ],
      mistake: 'Недостаточно записать только x > сдвига: точку, где аргумент равен 1, нужно исключить отдельно.',
    })
  },
  'v1-15': (rng, level, source, seed) => {
    const p = int(rng, 1, 9) / 10
    const q = int(rng, 1, 9) / 10
    const answer = Number(((1 - p) * (1 - q)).toFixed(2))
    return build(source, level, seed, {
      prompt: `Два игрока выполняют бросок с вероятностями успеха ${tex(p)} и ${tex(q)}. Какова вероятность, что оба промахнутся?`,
      accepted: [decimal(answer), answer.toFixed(2)], answer: tex(answer), placeholder: 'Введите вероятность',
      hint: 'Сначала найдите вероятность промаха каждого игрока: 1 − вероятность успеха.',
      steps: [
        { text: 'Находим вероятности промахов.', math: `1-${tex(p)}=${tex(1 - p)},\\qquad1-${tex(q)}=${tex(1 - q)}` },
        { text: 'Независимые события перемножаем.', math: `P=${tex(1 - p)}\\cdot${tex(1 - q)}=${tex(answer)}` },
      ],
      mistake: 'Для вопроса о промахах нельзя перемножать исходные вероятности успеха.',
    })
  },
  'v1-16': (rng, level, source, seed) => {
    const root = int(rng, 1, level === 'challenge' ? 4 : 3) * (rng() > 0.5 ? 1 : -1)
    const scale = level === 'base' ? 1 : int(rng, 1, 2)
    const cubic = 2 * scale
    const quadratic = -3 * root * scale
    const constant = int(rng, -4, 4)
    const low = Math.min(0, root)
    const high = Math.max(0, root)
    const increasing = `(-inf;${low})u(${high};inf)`
    const decreasing = `(${low};${high})`
    return build(source, level, seed, {
      prompt: 'Найдите промежутки монотонности функции. Сначала запишите возрастание, затем убывание.',
      math: `y=${cubic}x^3${signed(quadratic, 'x^2')}${signed(constant)}`,
      accepted: [`${increasing};${decreasing}`, `возрастает:${increasing};убывает:${decreasing}`],
      answer: `\\text{Возрастает: }(-\\infty;${low})\\cup(${high};+\\infty);\\quad\\text{убывает: }(${low};${high})`,
      placeholder: 'Сначала возрастание, затем убывание', hint: `Производная равна ${6 * scale}x(x − (${root})). Расставьте её знаки.`,
      steps: [
        { text: 'Находим производную и её нули.', math: `y'=${6 * scale}x^2${signed(-6 * scale * root, 'x')}=${6 * scale}x(x-${root}),\\qquad x=0,\\ x=${root}` },
        { text: 'Производная положительна на внешних промежутках.', math: `x\\in(-\\infty;${low})\\cup(${high};+\\infty)` },
        { text: 'Между корнями производная отрицательна.', math: `x\\in(${low};${high})` },
      ],
      mistake: 'Сначала сортируйте нули производной по числовой прямой, затем определяйте знак на каждом промежутке.',
    })
  },
  'v1-17': (rng, level, source, seed) => {
    const a = 3 * int(rng, level === 'base' ? 1 : -3, level === 'challenge' ? 4 : 3)
    const b = 2 * int(rng, -3, 3)
    const safeA = a === 0 ? 6 : a
    const answer = safeA / 3 - b / 2
    return build(source, level, seed, {
      prompt: 'Вычислите значение интеграла.', math: `\\int_{-1}^{0}(${safeA}x^2${signed(b, 'x')})\\,dx`,
      accepted: numeric(answer), answer: tex(answer), placeholder: 'Введите число',
      hint: `Первообразная: ${safeA / 3}x³ ${b < 0 ? '−' : '+'} ${absTex(b / 2)}x².`,
      steps: [
        { text: 'Интегрируем каждое слагаемое.', math: `F(x)=${safeA / 3}x^3${signed(b / 2, 'x^2')}` },
        { text: 'Вычитаем значение на нижнем пределе.', math: `F(0)-F(-1)=0-(${-safeA / 3}${signed(b / 2)})=${tex(answer)}` },
      ],
      mistake: 'По формуле Ньютона — Лейбница значение на нижнем пределе вычитается.',
    })
  },
  'v1-18': (rng, level, source, seed) => {
    const volume = 2 * int(rng, level === 'base' ? 5 : 10, level === 'challenge' ? 60 : 35)
    const answer = volume / 2
    return build(source, level, seed, {
      prompt: `Шар объёмом ${volume} вписан в цилиндр. Найдите объём конуса с теми же основанием и высотой, что у цилиндра.`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите объём',
      hint: 'У вписанного шара высота цилиндра равна 2r. Сравните формулы объёмов.',
      steps: [
        { text: 'Записываем оба объёма через r.', math: `V_{\\text{шара}}=\\frac43\\pi r^3,\\qquad V_{\\text{конуса}}=\\frac13\\pi r^2\\cdot2r=\\frac23\\pi r^3` },
        { text: 'Объём конуса составляет половину объёма шара.', math: `V_{\\text{конуса}}=\\frac12\\cdot${volume}=${answer}` },
      ],
      mistake: 'Коэффициент 1/3 относится к цилиндру; по отношению к объёму вписанного шара получается 1/2.',
    })
  },
  'v1-19': (rng, level, source, seed) => {
    const outer = int(rng, level === 'base' ? 3 : 4, level === 'challenge' ? 9 : 7)
    const inner = int(rng, 1, outer - 1)
    const base = int(rng, 2, 9)
    return build(source, level, seed, {
      prompt: 'Решите неравенство.', math: `\\sqrt{x^2-${outer ** 2}}\\cdot\\log_${base}(${inner ** 2}-x^2)<0`,
      accepted: ['∅', 'нетрешений', 'неткорней', 'пустоемножество'], answer: '\\varnothing', placeholder: 'Промежуток или «нет решений»',
      hint: 'Сравните ОДЗ корня и логарифма до анализа знака произведения.',
      steps: [
        { text: 'Подкоренное выражение неотрицательно.', math: `x^2-${outer ** 2}\\ge0\\Rightarrow|x|\\ge${outer}` },
        { text: 'Аргумент логарифма положителен.', math: `${inner ** 2}-x^2>0\\Rightarrow|x|<${inner}` },
        { text: `Условия |x| ≥ ${outer} и |x| < ${inner} несовместимы.`, math: '\\varnothing' },
      ],
      mistake: 'Здесь ответ даёт ОДЗ: знак произведения анализировать уже не на каком множестве.',
    })
  },
  'v1-20': (rng, level, source, seed) => {
    const q = int(rng, 1, level === 'challenge' ? 4 : 3)
    const p = int(rng, 1, 3)
    const secondRoot = pick(rng, level === 'base' ? [-1] : level === 'retake' ? [-1, -2] : [-1, -2, 1, 0.5])
    const a = q
    const b = -(p + q * secondRoot)
    const c = p * secondRoot
    const firstAnswer = `arctan(${p}/${q})`
    const secondAnswer = secondRoot === -1 ? '-pi/4' : secondRoot === 1 ? 'pi/4' : secondRoot === 0.5 ? 'arctan(1/2)' : 'arctan(-2)'
    const secondTex = secondRoot === -1 ? '-\\frac\\pi4' : secondRoot === 1 ? '\\frac\\pi4' : secondRoot === 0.5 ? '\\operatorname{arctg}\\frac12' : '\\operatorname{arctg}(-2)'
    return build(source, level, seed, {
      prompt: 'Решите уравнение.', math: `${a}\\sin^2x${signed(b, '\\sin x\\cos x')}${signed(c, '\\cos^2x')}=0`,
      accepted: [`${firstAnswer}+pin;${secondAnswer}+pin`, `${secondAnswer}+pin;${firstAnswer}+pin`, `x=${firstAnswer}+pin;x=${secondAnswer}+pin`],
      answer: `x=\\operatorname{arctg}\\frac{${p}}{${q}}+\\pi n;\\quad x=${secondTex}+\\pi n,\\ n\\in\\mathbb Z`,
      placeholder: 'Используйте arctan, pi и n', hint: 'Это однородное уравнение. Разделите на cos²x и сделайте замену t = tg x.',
      steps: [
        { text: 'При cos x = 0 уравнение не выполняется. Делим на cos²x.', math: `${a}t^2${signed(b, 't')}${signed(c)}=0,\\qquad t=\\operatorname{tg}x` },
        { text: 'Разлагаем квадратный трёхчлен.', math: `(${q}t-${p})(t-(${secondRoot}))=0\\Rightarrow t=\\frac{${p}}{${q}}\\quad\\text{или}\\quad t=${tex(secondRoot)}` },
        { text: 'Возвращаемся к x и учитываем период тангенса.', math: `x=\\operatorname{arctg}\\frac{${p}}{${q}}+\\pi n\\quad\\text{или}\\quad x=${secondTex}+\\pi n` },
      ],
      mistake: 'После замены решается квадратное уравнение. У тангенса период π, поэтому добавляем πn, а не 2πn.',
    })
  },
  'v1-10': (rng, level, source, seed) => {
    const zero = int(rng, 1, level === 'base' ? 1 : 2)
    const peak = zero + 1
    const height = int(rng, 2, level === 'challenge' ? 5 : 4)
    const depth = height * zero
    return build(source, level, seed, {
      prompt: 'По графику укажите точки максимума функции.', graph: true,
      graphSpec: { points: [[-4, height], [-peak, height], [0, -depth], [peak, height], [4, height]] },
      accepted: [`-${peak};${peak}`, `${peak};-${peak}`, `x=-${peak};x=${peak}`],
      answer: `x=-${peak};\\ x=${peak}`, placeholder: 'Например: −2; 2',
      hint: 'Точка максимума — абсцисса стыка, где убывание сменяется возрастанием относительно соседнего участка.',
      steps: [
        { text: 'Верхние горизонтальные участки начинаются после спуска и заканчиваются перед подъёмом.' },
        { text: 'Записываем абсциссы этих стыков.', math: `x=-${peak},\\qquad x=${peak}` },
      ],
      mistake: `В ответ идут значения x = ±${peak}, а не ордината y = ${height}.`,
    })
  },
  'v1-11': (rng, level, source, seed) => {
    const zero = int(rng, 1, level === 'base' ? 1 : 2)
    const peak = zero + 1
    const height = int(rng, 2, level === 'challenge' ? 5 : 4)
    const depth = height * zero
    const interval = `[-4;-${zero})u(${zero};4]`
    return build(source, level, seed, {
      prompt: 'При каких значениях аргумента функция принимает положительные значения?', graph: true,
      graphSpec: { points: [[-4, height], [-peak, height], [0, -depth], [peak, height], [4, height]] },
      accepted: [interval, `[-4;-${zero})∪(${zero};4]`],
      answer: `[-4;-${zero})\\cup(${zero};4]`, placeholder: 'Используйте U для объединения',
      hint: 'Нужны участки строго выше оси Ox. Точки пересечения с осью не включайте.',
      steps: [
        { text: `Прямые участки пересекают ось Ox при x = −${zero} и x = ${zero}.` },
        { text: 'Выбираем части графика выше оси.', math: `x\\in[-4;-${zero})\\cup(${zero};4]` },
      ],
      mistake: 'В нулях функции y = 0, а ноль не является положительным значением.',
    })
  },
  'v1-12': (rng, level, source, seed) => {
    const kind = level === 'base' ? 'even' : level === 'retake' ? 'odd' : pick(rng, ['even', 'odd', 'neither'] as const)
    const height = int(rng, 2, 4)
    const peak = int(rng, 1, 2) + 1
    let points: [number, number][]
    if (kind === 'even') points = [[-4, height], [-peak, height], [0, -height * (peak - 1)], [peak, height], [4, height]]
    else if (kind === 'odd') points = [[-4, -height], [-peak, -height], [0, 0], [peak, height], [4, height]]
    else points = [[-4, height], [-peak, height], [0, -height], [peak, height - 1], [4, height + 1]]
    const isOdd = kind === 'odd'
    return build(source, level, seed, {
      prompt: 'Является ли функция нечётной?', graph: true, graphSpec: { points },
      accepted: [isOdd ? 'да' : 'нет'], answer: isOdd ? '\\text{Да}' : '\\text{Нет}', placeholder: 'Да или нет',
      hint: 'У нечётной функции график симметричен относительно начала координат: f(−x) = −f(x).',
      steps: [
        { text: isOdd ? 'При противоположных x ординаты противоположны: график симметричен относительно начала координат.' : kind === 'even' ? 'График симметричен относительно оси Oy, поэтому функция чётная.' : 'Симметрии относительно начала координат нет: противоположным x не соответствуют противоположные y.' },
        { text: 'Делаем вывод по определению.', math: isOdd ? 'f(-x)=-f(x)' : 'f(-x)=-f(x)\\ \\text{выполняется не для всех }x' },
      ],
      mistake: 'Симметрия относительно оси Oy означает чётность; для нечётности нужна симметрия относительно точки (0; 0).',
    })
  },
  'v2-01': (rng, level, source, seed) => {
    const max = level === 'base' ? 7 : level === 'retake' ? 12 : 20
    const values = new Set<number>()
    while (values.size < 4) values.add(int(rng, 2, max))
    const radicands = [...values]
    const largest = Math.max(...radicands)
    return build(source, level, seed, {
      prompt: `Укажите наименьшее число: ${radicands.map((value) => `−√${value}`).join('; ')}.`,
      accepted: [`-sqrt${largest}`, `-√${largest}`], answer: `-\\sqrt{${largest}}`, placeholder: 'Например: −sqrt(5)',
      hint: 'Все числа отрицательные. Меньше то, у которого модуль больше.',
      steps: [
        { text: 'Корень возрастает, поэтому наибольший модуль у числа с наибольшим подкоренным значением.', math: `\\sqrt{${largest}}=\\max\\{${radicands.map((value) => `\\sqrt{${value}}`).join(',')}\\}` },
        { text: 'При умножении на −1 порядок меняется на противоположный.', math: `-\\sqrt{${largest}}\\ \\text{— наименьшее}` },
      ],
      mistake: 'Для отрицательных чисел наименьшее имеет наибольший, а не наименьший модуль.',
    })
  },
  'v2-02': (rng, level, source, seed) => {
    const tenths = int(rng, level === 'base' ? 2 : 3, level === 'challenge' ? 9 : 7)
    const value = tenths / 10
    const radicand = value ** 3
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `\\sqrt[3]{-${tex(radicand)}}`,
      accepted: [decimal(-value)], answer: `-${tex(value)}`, placeholder: 'Введите число',
      hint: `${tex(radicand)} = ${tex(value)}³.`,
      steps: [
        { text: 'Представляем модуль подкоренного числа как куб.', math: `-${tex(radicand)}=-(${tex(value)})^3` },
        { text: 'Извлекаем кубический корень.', math: `\\sqrt[3]{-(${tex(value)})^3}=-${tex(value)}` },
      ],
      mistake: 'Кубический корень из отрицательного числа определён и остаётся отрицательным.',
    })
  },
  'v2-03': (rng, level, source, seed) => {
    const base = int(rng, 2, level === 'challenge' ? 7 : 5)
    const q = int(rng, 3, level === 'challenge' ? 9 : 7)
    const u = int(rng, 1, level === 'challenge' ? 12 : 8)
    const v = u + q
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `${base}^{-${u}/${q}}:${base}^{-${v}/${q}}`,
      accepted: numeric(base), answer: String(base), placeholder: 'Введите число',
      hint: 'При делении степеней с одинаковым основанием вычитайте показатели.',
      steps: [
        { text: 'Вычитаем второй показатель из первого.', math: `${base}^{-${u}/${q}}:${base}^{-${v}/${q}}=${base}^{-${u}/${q}-(-${v}/${q})}` },
        { text: 'Упрощаем показатель.', math: `${base}^{(${v}-${u})/${q}}=${base}^1=${base}` },
      ],
      mistake: 'Второй показатель отрицательный: при его вычитании получается плюс.',
    })
  },
  'v2-04': (rng, level, source, seed) => {
    const base = int(rng, 2, level === 'challenge' ? 6 : 4)
    const power = int(rng, 2, level === 'challenge' ? 5 : 4)
    const argument = int(rng, 7, 30)
    const divisor = base ** power
    return build(source, level, seed, {
      prompt: 'Вычислите значение выражения.', math: `\\log_${base}${argument}-\\log_${base}\\frac{${argument}}{${divisor}}`,
      accepted: numeric(power), answer: String(power), placeholder: 'Введите число',
      hint: 'Разность логарифмов — логарифм частного аргументов.',
      steps: [
        { text: 'Объединяем логарифмы и сокращаем общий множитель.', math: `\\log_${base}\\left(${argument}:\\frac{${argument}}{${divisor}}\\right)=\\log_${base}${divisor}` },
        { text: `Представляем ${divisor} как степень основания ${base}.`, math: `\\log_${base}${base}^{${power}}=${power}` },
      ],
      mistake: 'Вычитаются логарифмы, а аргументы делятся друг на друга.',
    })
  },
  'v2-05': (rng, level, source, seed) => {
    const a = int(rng, 2, level === 'challenge' ? 8 : 5)
    const b = int(rng, 1, a - 1)
    const answer = a - b
    return build(source, level, seed, {
      prompt: 'Упростите выражение.', math: `\\frac{${a}\\cos x\\cdot\\operatorname{tg}x-${b}\\sin x}{\\sin x}`,
      accepted: numeric(answer), answer: String(answer), placeholder: 'Введите результат',
      hint: 'Замените tg x на sin x / cos x и сократите на ОДЗ.',
      steps: [
        { text: 'Упрощаем произведение косинуса и тангенса.', math: `\\cos x\\cdot\\operatorname{tg}x=\\sin x` },
        { text: 'Приводим подобные и сокращаем дробь.', math: `\\frac{${a}\\sin x-${b}\\sin x}{\\sin x}=\\frac{${answer}\\sin x}{\\sin x}=${answer}` },
      ],
      mistake: 'Исходное выражение определено только при sin x ≠ 0 и cos x ≠ 0; сокращение выполняется на этой ОДЗ.',
    })
  },
  'v2-06': (rng, level, source, seed) => {
    const n = int(rng, level === 'base' ? 6 : 9, level === 'challenge' ? 16 : 13)
    const k = int(rng, 2, n - 2)
    const denominator = n - k
    return build(source, level, seed, {
      prompt: 'Вычислите отношение размещений.', math: `A_{${n}}^{${k}}:A_{${n}}^{${k + 1}}`,
      accepted: [`1/${denominator}`, decimal(1 / denominator)], answer: `\\frac1{${denominator}}`, placeholder: 'Например: 1/3',
      hint: 'Aₙᵏ = n!/(n − k)!. После деления факториалы сократятся.',
      steps: [
        { text: 'Записываем размещения через факториалы.', math: `A_{${n}}^{${k}}=\\frac{${n}!}{${n - k}!},\\qquad A_{${n}}^{${k + 1}}=\\frac{${n}!}{${n - k - 1}!}` },
        { text: 'Делим и сокращаем.', math: `\\frac{${n}!}{${n - k}!}:\\frac{${n}!}{${n - k - 1}!}=\\frac{${n - k - 1}!}{${n - k}!}=\\frac1{${denominator}}` },
      ],
      mistake: 'При делении на дробь она переворачивается: меньший факториал оказывается в числителе.',
    })
  },
  'v2-07': (rng, level, source, seed) => {
    const bound = level === 'base' ? 3 : level === 'retake' ? 5 : 7
    const [cx, cy, cz, bx, by, bz] = Array.from({ length: 6 }, () => int(rng, -bound, bound))
    const m = int(rng, 2, level === 'challenge' ? 5 : 3)
    const vector = [cx - bx, cy - by, cz - bz]
    const result = vector.map((value) => -m * value)
    const tuple = `(${result.join(';')})`
    return build(source, level, seed, {
      prompt: `Найдите координаты вектора −${m}BC, если C(${cx}; ${cy}; ${cz}), B(${bx}; ${by}; ${bz}).`,
      math: `-${m}\\overrightarrow{BC}`, accepted: [tuple, result.join(';')], answer: tuple,
      placeholder: 'Например: (−12; 15; −6)', hint: 'Сначала BC = C − B, затем умножьте каждую координату на отрицательное число.',
      steps: [
        { text: 'Из координат конца вычитаем координаты начала.', math: `\\overrightarrow{BC}=(${vector.join(';')})` },
        { text: `Умножаем на −${m}.`, math: `-${m}\\overrightarrow{BC}=${tuple}` },
      ],
      mistake: 'Для BC вычитаем B из C. После этого отдельно учитываем минус в коэффициенте.',
    })
  },
  'v2-08': (rng, level, source, seed) => {
    const angle = pick(rng, level === 'base' ? [45] as const : level === 'retake' ? [30, 45] as const : [30, 45, 60] as const)
    const length = int(rng, 2, level === 'challenge' ? 12 : 8)
    const result = radicalHypotenuse(length, angle, 'cos')
    return build(source, level, seed, {
      prompt: `Прямая пересекает плоскость в точке C под углом ${angle}°. AB — перпендикуляр к плоскости, CB = ${length}. Найдите AC.`,
      math: `\\angle ACB=${angle}^\\circ,\\quad CB=${length}`, accepted: result.accepted, answer: result.answer,
      placeholder: 'Например: 5sqrt(2)', hint: 'CB — проекция AC и прилежащий катет. Используйте косинус.',
      steps: [
        { text: 'Записываем косинус угла между прямой и её проекцией.', math: `\\cos${angle}^\\circ=\\frac{CB}{AC}=\\frac{${length}}{AC}` },
        { text: 'Выражаем гипотенузу.', math: `AC=\\frac{${length}}{\\cos${angle}^\\circ}=${result.answer}` },
      ],
      mistake: 'Здесь дан прилежащий катет, поэтому нужен косинус, а не синус.',
    })
  },
  'v2-09': (rng, level, source, seed) => {
    const triples: readonly (readonly [number, number, number])[] = level === 'base' ? [[3, 4, 5], [6, 8, 10]] as const
      : level === 'retake' ? [[6, 8, 10], [5, 12, 13], [9, 12, 15]] as const
        : [[5, 12, 13], [8, 15, 17], [9, 40, 41], [12, 16, 20]] as const
    const [height, radius, generatrix] = pick(rng, triples)
    return build(source, level, seed, {
      prompt: `Образующая конуса равна ${generatrix}, а радиус основания ${radius}. Найдите высоту конуса.`,
      accepted: numeric(height), answer: String(height), placeholder: 'Введите высоту',
      hint: 'Высота, радиус и образующая образуют прямоугольный треугольник; образующая — гипотенуза.',
      steps: [
        { text: 'Применяем теорему Пифагора.', math: `l^2=h^2+r^2\\Rightarrow h^2=l^2-r^2` },
        { text: 'Подставляем значения.', math: `h=\\sqrt{${generatrix}^2-${radius}^2}=\\sqrt{${height ** 2}}=${height}` },
      ],
      mistake: 'Из квадрата образующей вычитаем квадрат радиуса, а не складываем их.',
    })
  },
  'v2-10': (rng, level, source, seed) => {
    const peak = int(rng, 1, 3)
    const height = int(rng, 2, level === 'challenge' ? 6 : 4)
    const leftHeight = int(rng, 1, 4)
    return build(source, level, seed, {
      prompt: `Укажите наибольшее значение функции на промежутке (${peak - 1}; ${peak + 1}).`, graph: true,
      graphSpec: { points: [[-4, leftHeight], [0, 0], [peak, height], [4, 0]] },
      accepted: numeric(height), answer: String(height), placeholder: 'Введите значение y',
      hint: 'На указанном промежутке найдите самую высокую точку и считайте её ординату.',
      steps: [
        { text: `Вершина на этом промежутке находится при x = ${peak}.` },
        { text: 'Наибольшее значение функции — координата y вершины.', math: `y_{\\max}=${height}` },
      ],
      mistake: `Спрашивают значение функции y = ${height}, а не абсциссу вершины x = ${peak}.`,
    })
  },
  'v2-11': (rng, level, source, seed) => {
    const peak = int(rng, 1, 3)
    const height = int(rng, 2, level === 'challenge' ? 6 : 4)
    const leftHeight = int(rng, 1, 4)
    return build(source, level, seed, {
      prompt: 'При каких значениях аргумента функция принимает положительные значения?', graph: true,
      graphSpec: { points: [[-4, leftHeight], [0, 0], [peak, height], [4, 0]] },
      accepted: ['[-4;0)u(0;4)', '[-4;0)∪(0;4)'], answer: '[-4;0)\\cup(0;4)', placeholder: 'Используйте U для объединения',
      hint: 'График выше оси Ox всюду, кроме точек, где y = 0.',
      steps: [
        { text: 'Функция равна нулю при x = 0 и x = 4.' },
        { text: 'На остальных показанных участках график выше оси.', math: 'x\\in[-4;0)\\cup(0;4)' },
      ],
      mistake: 'Обе точки с нулевой ординатой исключаются, даже если в одной из них график только касается оси.',
    })
  },
  'v2-12': (rng, level, source, seed) => {
    const peak = int(rng, 1, 3)
    const height = int(rng, 2, level === 'challenge' ? 6 : 4)
    const leftHeight = int(rng, 1, 4)
    return build(source, level, seed, {
      prompt: 'Укажите точку минимума функции.', graph: true,
      graphSpec: { points: [[-4, leftHeight], [0, 0], [peak, height], [4, 0]] },
      accepted: ['0', 'x=0'], answer: 'x=0', placeholder: 'Введите x',
      hint: 'В точке минимума убывание сменяется возрастанием. Нужна абсцисса.',
      steps: [
        { text: 'Слева от начала координат функция убывает, справа — возрастает.' },
        { text: 'Точка минимума — абсцисса этой вершины.', math: 'x=0' },
      ],
      mistake: 'Точка минимума — это x, а минимальное значение — y. Здесь они совпадают численно, но смысл разный.',
    })
  },
  'v2-13': (rng, level, source, seed) => {
    const base = int(rng, 2, level === 'challenge' ? 7 : 4)
    const a = pick(rng, [1, 2])
    const c = int(rng, -5, level === 'challenge' ? 9 : 6)
    const power = int(rng, 2, level === 'challenge' ? 7 : 5)
    const numerator = -power - c
    const boundary = numerator / a
    const boundaryText = decimal(boundary)
    const acceptedBoundary = a === 1 ? [boundaryText] : [boundaryText, `${numerator}/2`]
    return build(source, level, seed, {
      prompt: 'Решите неравенство.', math: `\\left(\\frac1{${base}}\\right)^{${a}x${signed(c)}}>${base}^{${power}}`,
      accepted: [...acceptedBoundary.map((value) => `x<${value}`), ...acceptedBoundary.map((value) => `(-inf;${value})`)],
      answer: `x<${tex(boundary)}`, placeholder: 'Например: x < −4,5',
      hint: `${base}^${power} = (1/${base})^−${power}. Основание меньше 1, поэтому знак сравнения показателей меняется.`,
      steps: [
        { text: 'Приводим правую часть к основанию 1/b.', math: `\\left(\\frac1{${base}}\\right)^{${a}x${signed(c)}}>\\left(\\frac1{${base}}\\right)^{-${power}}` },
        { text: 'Основание меньше 1 — меняем знак неравенства.', math: `${a}x${signed(c)}<-${power}` },
        { text: 'Решаем линейное неравенство.', math: `${a}x<${numerator}\\Rightarrow x<${tex(boundary)}` },
      ],
      mistake: 'У показательного неравенства с основанием от 0 до 1 знак меняется на противоположный.',
    })
  },
  'v2-14': (rng, level, source, seed) => {
    const radius = int(rng, level === 'base' ? 2 : 4, level === 'challenge' ? 13 : 9)
    const base = int(rng, 2, 9)
    return build(source, level, seed, {
      prompt: 'Найдите область определения функции.', math: `y=\\log_${base}(${radius ** 2}-x^2)`,
      accepted: [`(-${radius};${radius})`, `-${radius}<x<${radius}`], answer: `(-${radius};${radius})`, placeholder: 'Например: (−6; 6)',
      hint: 'Аргумент логарифма должен быть строго положительным.',
      steps: [
        { text: 'Составляем условие.', math: `${radius ** 2}-x^2>0` },
        { text: 'Решаем квадратное неравенство.', math: `x^2<${radius ** 2}\\Rightarrow-${radius}<x<${radius}` },
        { text: 'Записываем область определения.', math: `D(y)=(-${radius};${radius})` },
      ],
      mistake: 'Границы не включаются: на них аргумент логарифма равен нулю.',
    })
  },
  'v2-15': (rng, level, source, seed) => {
    const p = int(rng, 1, 9) / 10
    const count = level === 'base' ? int(rng, 2, 3) : level === 'retake' ? 3 : int(rng, 3, 4)
    const answer = p ** count
    return build(source, level, seed, {
      prompt: `Вероятность успеха в одной попытке равна ${tex(p)}. Какова вероятность ${count} успехов подряд без единой неудачи?`,
      accepted: [decimal(answer), answer.toFixed(count)], answer: tex(answer), placeholder: 'Введите вероятность',
      hint: 'Все независимые попытки должны быть успешными, поэтому вероятности перемножаются.',
      steps: [
        { text: `Нужна последовательность из ${count} успехов.` },
        { text: 'Возводим вероятность одного успеха в степень.', math: `P=${tex(p)}^{${count}}=${tex(answer)}` },
      ],
      mistake: 'Для последовательности независимых событий вероятности не складывают, а перемножают.',
    })
  },
  'v2-16': (rng, level, source, seed) => {
    const a = pick(rng, level === 'base' ? [2, 4] : [1, 2, 3, 4])
    const x0 = pick(rng, level === 'base' ? [4, 9] : level === 'retake' ? [2, 4, 9] : [2, 3, 5, 4, 9])
    const constant = int(rng, -5, 7)
    const slope = a / (2 * Math.sqrt(x0))
    const degrees = Math.atan(slope) * 180 / Math.PI
    const squareRoot = Math.sqrt(x0)
    const exact = Number.isInteger(squareRoot) ? `\\frac{${a}}{${2 * squareRoot}}` : `\\frac{${a}}{2\\sqrt{${x0}}}`
    const acceptedExact = Number.isInteger(squareRoot) ? `arctan(${a}/${2 * squareRoot})` : `arctan(${a}/(2sqrt${x0}))`
    return build(source, level, seed, {
      prompt: `Найдите угол наклона касательной к графику функции в точке x₀ = ${x0}.`, math: `y=${a}\\sqrt{x}${signed(constant)}`,
      accepted: [acceptedExact, `arctan(${a}/(2sqrt(${x0})))`, degrees.toFixed(2), decimal(Number(degrees.toFixed(2)))],
      answer: `\\operatorname{arctg}${exact}\\approx${tex(Number(degrees.toFixed(2)))}^\\circ`,
      placeholder: 'Например: arctan(1/sqrt(2))', hint: 'Угловой коэффициент k = f′(x₀), а угол α = arctg k.',
      steps: [
        { text: 'Находим производную; константа исчезает.', math: `y'=\\frac{${a}}{2\\sqrt{x}}` },
        { text: 'Вычисляем угловой коэффициент.', math: `k=y'(${x0})=${exact}` },
        { text: 'Переводим коэффициент в угол.', math: `\\alpha=\\operatorname{arctg}k\\approx${tex(Number(degrees.toFixed(2)))}^\\circ` },
      ],
      mistake: 'Сначала дифференцируем, затем подставляем x₀. Константа в функции на угол наклона не влияет.',
    })
  },
  'v2-17': (rng, level, source, seed) => {
    let a = 2 * int(rng, -5, level === 'challenge' ? 7 : 5)
    if (a === 0) a = 8
    let b = 5 * int(rng, 1, level === 'challenge' ? 4 : 3)
    if (b === 0) b = 10
    const answer = -a / 2 - b / 5
    return build(source, level, seed, {
      prompt: 'Вычислите значение интеграла.', math: `\\int_{-1}^{0}(${a}x-${b}x^4)\\,dx`,
      accepted: numeric(answer), answer: tex(answer), placeholder: 'Введите число',
      hint: `Первообразная: ${a / 2}x² − ${b / 5}x⁵.`,
      steps: [
        { text: 'Интегрируем каждое слагаемое.', math: `F(x)=${a / 2}x^2-${b / 5}x^5` },
        { text: 'Подставляем пределы и вычитаем F(−1).', math: `F(0)-F(-1)=0-(${a / 2}+${b / 5})=${tex(answer)}` },
      ],
      mistake: 'При x = −1 слагаемое с x⁵ меняет знак; затем всё значение F(−1) вычитается.',
    })
  },
  'v2-18': (rng, level, source, seed) => {
    const scale = level === 'base' ? 2 : pick(rng, [2, 3])
    const answer = int(rng, 2, level === 'challenge' ? 12 : 8)
    const height = answer * scale ** 2
    return build(source, level, seed, {
      prompt: `В правильную треугольную призму налили воду до высоты ${height} см. Какой станет высота воды в такой же призме, у которой сторона основания в ${scale} раза больше?`,
      accepted: [String(answer), `${answer}см`], answer: `${answer}\\text{ см}`, placeholder: 'Введите высоту в см',
      hint: 'Площадь подобного основания увеличивается в квадрат коэффициента подобия.',
      steps: [
        { text: `Площадь основания увеличивается в ${scale}² = ${scale ** 2} раза.` },
        { text: 'Объём воды сохраняется, поэтому высота уменьшается во столько же раз.', math: `h_2=\\frac{${height}}{${scale ** 2}}=${answer}\\text{ см}` },
      ],
      mistake: 'Линейные размеры увеличиваются в k раз, а площадь — в k² раз.',
    })
  },
  'v2-19': (rng, level, source, seed) => {
    const root = int(rng, 1, level === 'challenge' ? 4 : 3)
    const constant = 9 * root * (root + 1)
    const boundary = root === 1 ? '0' : root === 3 ? '1' : `log_3${root}`
    const boundaryTex = root === 1 ? '0' : root === 3 ? '1' : `\\log_3${root}`
    const accepted = root === 1 ? ['x>0', '(0;inf)'] : root === 3 ? ['x>1', '(1;inf)'] : [`x>${boundary}`, `(${boundary};inf)`, `x>log(3,${root})`]
    return build(source, level, seed, {
      prompt: 'Найдите область определения функции.', math: `y=\\frac1{\\sqrt{9^{x+1}+3^{x+2}-${constant}}}`,
      accepted, answer: `(${boundaryTex};+\\infty)`, placeholder: 'Например: (0; inf)',
      hint: 'Под корнем в знаменателе нужно строго > 0. После замены t = 3ˣ получится квадратное неравенство.',
      steps: [
        { text: 'Выносим коэффициенты и делаем замену t = 3ˣ > 0.', math: `9^{x+1}+3^{x+2}-${constant}>0\\iff9t^2+9t-${constant}>0` },
        { text: 'Делим на 9 и раскладываем на множители.', math: `t^2+t-${root * (root + 1)}>0\\iff(t+${root + 1})(t-${root})>0` },
        { text: 'С учётом t > 0 оставляем t > корня и возвращаемся к x.', math: `3^x>${root}\\Rightarrow x>${boundaryTex}` },
      ],
      mistake: 'Корень стоит в знаменателе, поэтому подкоренное выражение строго положительно; граница не включается.',
    })
  },
  'v2-20': (rng, level, source, seed) => {
    const a = int(rng, 2, level === 'challenge' ? 12 : 7)
    return build(source, level, seed, {
      prompt: 'Решите уравнение.', math: `${a}\\sin^2x-\\cos x=-${a}`,
      accepted: ['∅', 'нетрешений', 'неткорней', 'пустоемножество'], answer: '\\varnothing', placeholder: 'Корни или «нет решений»',
      hint: 'Замените sin²x на 1 − cos²x и исследуйте квадратный трёхчлен на [−1; 1].',
      steps: [
        { text: 'Переходим к одной функции и обозначаем t = cos x.', math: `${a}(1-t^2)-t=-${a}\\iff${a}t^2+t-${2 * a}=0` },
        { text: `На отрезке [−1; 1] значение трёхчлена отрицательно: на концах получаем ${1 - a} и ${-a - 1}, а вершина параболы лежит между ними.` },
        { text: 'Следовательно, корней с t ∈ [−1; 1] нет, а другие значения косинус принимать не может.', math: '\\varnothing' },
      ],
      mistake: 'После замены t = cos x обязательно учитывайте ограничение −1 ≤ t ≤ 1.',
    })
  },
}

export const practiceSources = tasks

export function generatePracticeTask(sourceId: string, level: PracticeLevel, seed: number): GeneratedTask {
  const source = tasks.find((task) => task.id === sourceId) ?? tasks[0]
  const generator = generators[source.id]
  if (!generator) throw new Error(`Нет генератора для ${source.id}`)
  const safeSeed = Math.max(1, Math.abs(Math.floor(seed)) || 1)
  return generator(makeRng(`${source.id}:${level}:${safeSeed}`), level, source, safeSeed)
}

export const practiceGeneratorIds = Object.keys(generators)
