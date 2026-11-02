import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Flag,
  Lightbulb,
  PencilLine,
  RotateCcw,
  Shuffle,
  Target,
  Trophy,
  Undo2,
} from 'lucide-react'
import { MathBlock } from '@/components/Math'
import { FunctionGraph } from '@/components/FunctionGraph'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { tasks, TOPICS, type Topic } from '@/data/tasks'
import { getAnyTask, similarBySource, similarTasks } from '@/data/similarTasks'

const STORAGE_KEY = 'retake-trainer-solved-v1'
const PRACTICE_STORAGE_KEY = 'retake-trainer-similar-v1'
type TopicFilter = 'Все темы' | Topic
type Feedback = 'idle' | 'correct' | 'wrong' | 'empty'

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/\*/g, '')
    .replace(/∞/g, 'inf')
    .replace(/∪/g, 'u')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/sqrt\(([^()]+)\)/g, 'sqrt$1')
    .replace(/(?<=\d),(?=\d)/g, '.')
    .replace(/пустоемножество|нетрешений|неткорней/g, '∅')
}

function readSolved(storageKey: string, sourceTasks: typeof tasks) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const validIds = new Set(sourceTasks.map((task) => task.id))
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id))
  } catch {
    return []
  }
}

function getLevel(count: number) {
  if (count === 40) return 'Можно идти на пересдачу'
  if (count >= 30) return 'Финиш уже близко'
  if (count >= 18) return 'Уверенный уровень'
  if (count >= 8) return 'Ты вошёл в ритм'
  if (count >= 1) return 'Начало положено'
  return 'Твой первый шаг'
}

const cheatSheets: { topic: Topic; formulas: string[]; note: string }[] = [
  { topic: 'Степени и логарифмы', formulas: ['a^m\\cdot a^n=a^{m+n}', '\\log_a b+\\log_a c=\\log_a(bc)'], note: 'Сначала приводи к одному основанию. При делении степеней показатели вычитай.' },
  { topic: 'Тригонометрия', formulas: ['\\sin2x=2\\sin x\\cos x', '\\sin^2x+\\cos^2x=1'], note: 'Проверяй обе серии корней и не забывай n ∈ Z.' },
  { topic: 'Комбинаторика и вероятность', formulas: ['C_n^k=\\frac{n!}{k!(n-k)!}', 'A_n^k=\\frac{n!}{(n-k)!}'], note: 'Порядок важен — размещение, не важен — сочетание. Независимые вероятности перемножаются.' },
  { topic: 'Векторы и стереометрия', formulas: ['\\overrightarrow{BC}=C-B', 'l^2=h^2+r^2'], note: 'Векторы считай покоординатно. В стереометрии ищи прямоугольный треугольник.' },
  { topic: 'Графики функций', formulas: ['f(x)>0\\iff\\text{график выше }Ox'], note: 'Точка максимума или минимума — это x. Значение функции — это y.' },
  { topic: 'Уравнения и неравенства', formulas: ['0<a<1:\\quad a^u>a^v\\iff u<v'], note: 'Начинай с ОДЗ. У показательного неравенства с основанием меньше 1 меняй знак.' },
  { topic: 'Область определения', formulas: ['\\log_a u:\\ u>0', '\\frac1u:\\ u\\ne0', '\\sqrt u:\\ u\\ge0'], note: 'Собери все ограничения и пересеки их. Для корня в знаменателе нужно u > 0.' },
  { topic: 'Производная и интеграл', formulas: ["f'(x)>0\\Rightarrow f\\uparrow", '\\int_a^b f(x)dx=F(b)-F(a)'], note: 'Нули производной делят числовую прямую на промежутки знаков.' },
  { topic: 'Степени и логарифмы', formulas: ['\\frac{a^m}{a^n}=a^{m-n}', '(a^m)^n=a^{mn}', '\\sqrt[n]{a^m}=a^{m/n}'], note: 'Отрицательный показатель переворачивает число: a⁻ⁿ = 1/aⁿ.' },
  { topic: 'Степени и логарифмы', formulas: ['\\log_a b=\\frac{\\log_c b}{\\log_c a}', 'a^{\\log_a b}=b'], note: 'Дополнительно: logₐ1 = 0, logₐa = 1, а разность логарифмов — логарифм частного.' },
  { topic: 'Тригонометрия', formulas: ['\\sin\\frac\\pi6=\\frac12', '\\sin\\frac\\pi4=\\frac{\\sqrt2}2', '\\sin\\frac\\pi3=\\frac{\\sqrt3}2'], note: 'Косинусы тех же углов читают в обратном порядке: √3/2, √2/2, 1/2.' },
  { topic: 'Тригонометрия', formulas: ['\\operatorname{tg}x=\\frac{\\sin x}{\\cos x}', '\\cos2x=\\cos^2x-\\sin^2x'], note: 'При решении уравнений проверяй обе серии корней и область значений: sin x и cos x ∈ [−1; 1].' },
  { topic: 'Производная и интеграл', formulas: ["(x^n)'=nx^{n-1}", "(\\sqrt{x})'=\\frac1{2\\sqrt{x}}", "c'=0"], note: 'Ещё: (sin x)′ = cos x, (cos x)′ = −sin x. Коэффициент выносится за знак производной.' },
  { topic: 'Производная и интеграл', formulas: ['\\int x^n dx=\\frac{x^{n+1}}{n+1}+C,\\quad n\\ne-1'], note: 'Интегрируй каждое слагаемое отдельно. ∫sin x dx = −cos x + C, ∫cos x dx = sin x + C.' },
  { topic: 'Комбинаторика и вероятность', formulas: ['P(\\bar A)=1-P(A)', 'P(A\\cap B)=P(A)P(B)'], note: 'Формула произведения здесь для независимых событий. «Хотя бы один» часто удобно искать через противоположное событие.' },
  { topic: 'Векторы и стереометрия', formulas: ['V_{\\text{цил}}=\\pi r^2h', 'V_{\\text{кон}}=\\frac13\\pi r^2h', 'V_{\\text{шара}}=\\frac43\\pi r^3'], note: 'Sбок цилиндра = 2πrh, Sбок конуса = πrl. В подобных фигурах площади относятся как k², объёмы — как k³.' },
  { topic: 'Уравнения и неравенства', formulas: ['D=b^2-4ac', 'x=\\frac{-b\\pm\\sqrt D}{2a}'], note: 'Если D > 0 — два корня, D = 0 — один, D < 0 — действительных корней нет. После замены проверь ограничения новой переменной.' },
]

export default function App() {
  const [variant, setVariant] = useState<1 | 2>(1)
  const [topic, setTopic] = useState<TopicFilter>('Все темы')
  const [currentId, setCurrentId] = useState('v1-01')
  const [solved, setSolved] = useState<string[]>(() => readSolved(STORAGE_KEY, tasks))
  const [practiceSolved, setPracticeSolved] = useState<string[]>(() => readSolved(PRACTICE_STORAGE_KEY, similarTasks))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintOpen, setHintOpen] = useState(false)
  const [solutionOpen, setSolutionOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const currentTask = getAnyTask(currentId)
  const solvedSet = useMemo(() => new Set(solved), [solved])
  const practiceSet = useMemo(() => new Set(practiceSolved), [practiceSolved])
  const isPractice = Boolean(currentTask.similarOf)
  const activeSolvedSet = isPractice ? practiceSet : solvedSet
  const linkedTask = isPractice ? getAnyTask(currentTask.similarOf!) : similarBySource.get(currentTask.id)

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.variant === variant && (topic === 'Все темы' || task.topic === topic)),
    [variant, topic],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solved))
  }, [solved])

  useEffect(() => {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(practiceSolved))
  }, [practiceSolved])

  const selectTask = (id: string, shouldScroll = false) => {
    const next = getAnyTask(id)
    setCurrentId(next.id)
    setVariant(next.variant)
    setAnswer('')
    setFeedback('idle')
    setHintOpen(false)
    setSolutionOpen(false)
    if (shouldScroll) {
      window.setTimeout(() => document.getElementById('task-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 20)
    }
  }

  const changeVariant = (nextVariant: 1 | 2) => {
    const next = tasks.find((task) => task.variant === nextVariant && !solvedSet.has(task.id))
      ?? tasks.find((task) => task.variant === nextVariant)!
    setTopic('Все темы')
    selectTask(next.id, true)
  }

  const changeTopic = (nextTopic: TopicFilter) => {
    setTopic(nextTopic)
    const next = tasks.find((task) => task.variant === variant && (nextTopic === 'Все темы' || task.topic === nextTopic))
    if (next) selectTask(next.id, true)
  }

  const startFirstUnsolved = () => {
    const next = tasks.find((task) => !solvedSet.has(task.id)) ?? tasks[0]
    setTopic('Все темы')
    selectTask(next.id, true)
  }

  const goNext = () => {
    const pool = isPractice
      ? similarTasks.filter((task) => task.variant === variant)
      : visibleTasks.length > 0 ? visibleTasks : tasks.filter((task) => task.variant === variant)
    const index = pool.findIndex((task) => task.id === currentId)
    const next = pool[(index + 1 + pool.length) % pool.length]
    selectTask(next.id, true)
  }

  const checkAnswer = (event: React.FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) {
      setFeedback('empty')
      return
    }
    const normalized = normalizeAnswer(answer)
    const isCorrect = currentTask.accepted.some((item) => normalizeAnswer(item) === normalized)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      const updateSolved = isPractice ? setPracticeSolved : setSolved
      updateSolved((previous) => previous.includes(currentTask.id) ? previous : [...previous, currentTask.id])
      setStreak((previous) => previous + 1)
    } else {
      setStreak(0)
    }
  }

  const resetProgress = () => {
    setSolved([])
    setPracticeSolved([])
    setStreak(0)
    setTopic('Все темы')
    selectTask('v1-01')
    setResetOpen(false)
  }

  const progress = Math.round((solved.length / tasks.length) * 100)
  const currentVariantSolved = tasks.filter((task) => task.variant === variant && solvedSet.has(task.id)).length

  return (
    <div id="top" className="min-h-dvh bg-[var(--page)] text-[var(--ink)]">
      <a href="#trainer" className="skip-link">Перейти к заданиям</a>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Пересдача без паники — наверх">
          <span className="brand-mark">ПБП</span>
          <span className="brand-name">Пересдача<br />без паники</span>
        </a>
        <nav className="main-nav" aria-label="Основная навигация">
          <a href="#trainer">Тренажёр</a>
          <a href="#topics">Темы</a>
          <a href="#plan">План</a>
        </nav>
        <Dialog>
          <DialogTrigger asChild>
            <button className="header-book" type="button">
              <BookOpen size={18} aria-hidden="true" />
              <span>Шпаргалка</span>
            </button>
          </DialogTrigger>
          <DialogContent className="cheat-dialog">
            <DialogHeader>
              <DialogTitle className="dialog-title">Формулы, которые решают</DialogTitle>
              <DialogDescription className="dialog-description">Короткая опора перед тренировкой. Сначала попробуй вспомнить формулу сам.</DialogDescription>
            </DialogHeader>
            <div className="cheat-method" aria-label="Универсальный порядок решения">
              <strong>Порядок решения</strong>
              <span><b>1</b> Найди ограничения</span>
              <span><b>2</b> Выбери формулу</span>
              <span><b>3</b> Реши по шагам</span>
              <span><b>4</b> Проверь ответ</span>
            </div>
            <div className="cheat-grid">
              {cheatSheets.map((sheet, index) => (
                <section className="cheat-item" key={`${sheet.topic}-${index}`}>
                  <h3>{sheet.topic}</h3>
                  <div className="cheat-formulas">
                    {sheet.formulas.map((formula) => <MathBlock key={formula}>{formula}</MathBlock>)}
                  </div>
                  <p>{sheet.note}</p>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-kicker"><PencilLine size={18} aria-hidden="true" /> 40 заданий из файла + 40 похожих.</p>
            <h1 id="hero-title"><span>Не зубри.</span><span>Научись решать.</span></h1>
            <div className="hero-bottom">
              <p>Разбирай каждую задачу по шагам, закрепляй похожей и превращай «не понимаю» в «могу объяснить». Пересдача — это не приговор, а ещё одна попытка, к которой ты готовишься.</p>
              <button className="primary-cta" type="button" onClick={startFirstUnsolved}>
                {solved.length ? 'Продолжить подготовку' : 'Решить первую задачу'}
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <aside className="hero-progress" aria-label="Общий прогресс">
            <span className="vertical-note">ПРОГРЕСС ВИДЕН</span>
            <div className="progress-orbit" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{progress}%</strong><span>готовности</span></div>
            </div>
            <div className="hero-progress-copy">
              <span>{getLevel(solved.length)}</span>
              <strong>{solved.length} из 40</strong>
              <p>{solved.length === 0 ? 'Не нужно знать всё сейчас. Нужно начать с одной задачи.' : 'Каждая отмеченная задача — ещё одна тема, которую ты смог.'}</p>
            </div>
          </aside>
          <div className="hero-stats" aria-label="Состав тренажёра">
            <div><strong>40</strong><span>заданий из файла</span></div>
            <div><strong>40</strong><span>похожих для закрепления</span></div>
            <div><strong>∞</strong><span>попыток без оценок</span></div>
          </div>
        </section>

        <section id="trainer" className="trainer-section" aria-labelledby="trainer-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Тренажёр</p>
              <h2 id="trainer-title">Одна задача.<br />Полное внимание.</h2>
            </div>
            <p>Реши на черновике, введи ответ и только потом открывай разбор. Затем нажми «Похожая задача» и закрепи метод на новых числах.</p>
          </div>

          <div className="trainer-shell">
            <aside className="task-sidebar" aria-label="Выбор заданий">
              <div className="variant-switch" aria-label="Выбор варианта">
                {([1, 2] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={variant === item ? 'active' : ''}
                    aria-pressed={variant === item}
                    onClick={() => changeVariant(item)}
                  >
                    Вариант {item}
                  </button>
                ))}
              </div>

              <label className="topic-select-label" htmlFor="topic-filter">Тема тренировки</label>
              <select id="topic-filter" value={topic} onChange={(event) => changeTopic(event.target.value as TopicFilter)}>
                <option>Все темы</option>
                {TOPICS.map((item) => <option key={item}>{item}</option>)}
              </select>

              <div className="task-list-heading">
                <span>Задания</span>
                <span>{currentVariantSolved}/20</span>
              </div>
              <div className="task-grid">
                {visibleTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`${currentId === task.id ? 'current' : ''} ${solvedSet.has(task.id) ? 'solved' : ''}`}
                    onClick={() => selectTask(task.id, true)}
                    aria-label={`Задание ${task.number}${solvedSet.has(task.id) ? ', решено' : ''}`}
                    aria-current={currentId === task.id ? 'true' : undefined}
                  >
                    {solvedSet.has(task.id) ? <Check size={16} aria-hidden="true" /> : task.number}
                  </button>
                ))}
              </div>

              <div className="sidebar-progress">
                <div><span>Общий прогресс</span><strong>{solved.length}/40</strong></div>
                <div className="linear-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
                <p>Сохраняется в этом браузере</p>
              </div>
              <div className="practice-progress"><span>Похожие задачи</span><strong>{practiceSolved.length}/40</strong></div>
              <button className="reset-button" type="button" onClick={() => setResetOpen(true)}>
                <RotateCcw size={16} aria-hidden="true" /> Сбросить прогресс
              </button>
            </aside>

            <article id="task-workspace" className="task-workspace" aria-labelledby="task-title">
              <div className="task-meta">
                <span>{isPractice ? `Похожая к заданию ${currentTask.number}` : `Вариант ${currentTask.variant} / Задание ${currentTask.number}`}</span>
                <span>{isPractice ? 'Режим закрепления' : currentTask.number >= 19 ? 'Дополнительная часть' : 'Обязательная часть'}</span>
              </div>
              <div className="task-topic">{isPractice ? 'Тренировка похожих · ' : ''}{currentTask.topic}</div>
              <h3 id="task-title">{currentTask.prompt}</h3>
              {currentTask.math && <MathBlock className="task-formula">{currentTask.math}</MathBlock>}
              {currentTask.graph && <FunctionGraph variant={currentTask.graphVariant ?? currentTask.variant} />}

              <form className="answer-form" onSubmit={checkAnswer}>
                <label htmlFor="answer-input">Твой ответ</label>
                <div className="answer-row">
                  <input
                    id="answer-input"
                    value={answer}
                    onChange={(event) => { setAnswer(event.target.value); if (feedback !== 'idle') setFeedback('idle') }}
                    placeholder={currentTask.placeholder}
                    autoComplete="off"
                    aria-describedby="answer-format answer-feedback"
                  />
                  <button type="submit" className="check-button">Проверить <ArrowRight size={18} aria-hidden="true" /></button>
                </div>
                <p id="answer-format" className="format-note">Можно писать sqrt(2), pi, inf и U вместо ∪. Обычную дробь вводи через /.</p>
              </form>

              <div id="answer-feedback" className="feedback-region" aria-live="polite">
                {feedback === 'correct' && (
                  <div className="feedback correct-feedback">
                    <CheckCircle2 size={24} aria-hidden="true" />
                    <div><strong>Верно. Ещё одна задача твоя.</strong><p>{streak >= 3 ? `Серия: ${streak} верных ответа подряд. Отличный темп.` : 'Ты не угадал — ты решил. Закрепи результат следующей задачей.'}</p></div>
                  </div>
                )}
                {feedback === 'wrong' && (
                  <div className="feedback wrong-feedback">
                    <Target size={24} aria-hidden="true" />
                    <div><strong>Пока не сходится — и это рабочий момент.</strong><p>{currentTask.mistake}</p></div>
                  </div>
                )}
                {feedback === 'empty' && <p className="empty-feedback">Сначала запиши ответ. Если не получается, открой подсказку ниже.</p>}
              </div>

              <div className="help-actions">
                <button type="button" onClick={() => setHintOpen((value) => !value)} aria-expanded={hintOpen} aria-controls="task-hint">
                  <Lightbulb size={19} aria-hidden="true" /> {hintOpen ? 'Скрыть подсказку' : 'Дать подсказку'}
                </button>
                <button type="button" onClick={() => setSolutionOpen((value) => !value)} aria-expanded={solutionOpen} aria-controls="task-solution">
                  <CircleHelp size={19} aria-hidden="true" /> {solutionOpen ? 'Скрыть разбор' : 'Показать разбор'}
                </button>
                {linkedTask && (
                  <button type="button" className="similar-task-button" onClick={() => selectTask(linkedTask.id, true)}>
                    {isPractice ? <Undo2 size={19} aria-hidden="true" /> : <Shuffle size={19} aria-hidden="true" />}
                    {isPractice ? 'К исходной задаче' : 'Похожая задача'}
                  </button>
                )}
              </div>

              {hintOpen && (
                <div id="task-hint" className="hint-panel">
                  <span>Подсказка, не ответ</span>
                  <p>{currentTask.hint}</p>
                </div>
              )}

              {solutionOpen && (
                <div id="task-solution" className="solution-panel">
                  <div className="solution-heading"><span>Разбор по шагам</span><PencilLine size={20} aria-hidden="true" /></div>
                  <ol>
                    {currentTask.steps.map((step, index) => (
                      <li key={`${currentTask.id}-${index}`}>
                        <span>{index + 1}</span>
                        <div><p>{step.text}</p>{step.math && <MathBlock>{step.math}</MathBlock>}</div>
                      </li>
                    ))}
                  </ol>
                  <div className="solution-answer"><strong>Ответ</strong><MathBlock>{currentTask.answer}</MathBlock></div>
                  <p className="mistake-note"><strong>На что обратить внимание:</strong> {currentTask.mistake}</p>
                </div>
              )}

              <div className="task-footer">
                <span>{activeSolvedSet.has(currentTask.id) ? <><Check size={17} aria-hidden="true" /> Задание уже в твоём прогрессе</> : 'Можно пробовать сколько угодно раз'}</span>
                <button type="button" onClick={goNext}>Следующая задача <ChevronRight size={19} aria-hidden="true" /></button>
              </div>
            </article>
          </div>
        </section>

        <section id="topics" className="topics-section" aria-labelledby="topics-title">
          <div className="topics-intro">
            <p className="section-label">Карта тем</p>
            <h2 id="topics-title">Видно не только пробелы. Видно рост.</h2>
            <p>Выбери тему — тренажёр откроет её задания. Не жди идеального настроения: пятнадцать focused-минут лучше двух часов откладывания.</p>
          </div>
          <div className="topic-rows">
            {TOPICS.map((item) => {
              const topicTasks = tasks.filter((task) => task.topic === item)
              const done = topicTasks.filter((task) => solvedSet.has(task.id)).length
              return (
                <button key={item} type="button" onClick={() => { setTopic(item); selectTask(tasks.find((task) => task.variant === 1 && task.topic === item)!.id, true) }}>
                  <span className="topic-name">{item}</span>
                  <span className="topic-count">{done}/{topicTasks.length} решено</span>
                  <span className="topic-line" aria-hidden="true"><i style={{ width: `${(done / topicTasks.length) * 100}%` }} /></span>
                  <ArrowUpRight size={22} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </section>

        <section id="plan" className="plan-section" aria-labelledby="plan-title">
          <div className="plan-heading">
            <Flag size={28} aria-hidden="true" />
            <p className="section-label">Стратегия на пересдачу</p>
            <h2 id="plan-title">Три прохода.<br />Спокойная голова.</h2>
          </div>
          <div className="plan-rows">
            <button type="button" onClick={() => selectTask('v1-01', true)}>
              <span className="plan-number">1</span>
              <span><strong>Сними страх базы</strong><small>Задания 1–9: формулы, вычисления, геометрия.</small></span>
              <ArrowUpRight size={24} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => selectTask('v1-10', true)}>
              <span className="plan-number">2</span>
              <span><strong>Собери уверенность</strong><small>Задания 10–18: графики, вероятность, анализ.</small></span>
              <ArrowUpRight size={24} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => selectTask('v1-19', true)}>
              <span className="plan-number">3</span>
              <span><strong>Докажи, что можешь больше</strong><small>Задания 19–20: дополнительная часть без спешки.</small></span>
              <ArrowUpRight size={24} aria-hidden="true" />
            </button>
          </div>
          <div className="plan-motto"><Trophy size={26} aria-hidden="true" /><p>Тебе не нужно стать другим человеком к пересдаче. Достаточно сегодня решить на одну задачу больше, чем вчера.</p></div>
        </section>
      </main>

      <footer>
        <a href="#top" className="footer-brand">Пересдача без паники <ArrowUpRight size={18} aria-hidden="true" /></a>
        <p>80 заданий · подсказки · пошаговые разборы</p>
        <p>Прогресс хранится только в этом браузере и не синхронизируется между устройствами.</p>
      </footer>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="reset-dialog">
          <DialogHeader>
            <DialogTitle className="dialog-title">Начать прогресс заново?</DialogTitle>
            <DialogDescription className="dialog-description">Отметки об исходных и похожих решённых заданиях будут удалены. Сами разборы останутся доступны.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><button type="button" className="dialog-cancel">Отмена</button></DialogClose>
            <button type="button" className="dialog-confirm" onClick={resetProgress}>Сбросить прогресс</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
