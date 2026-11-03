import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Dices,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react'
import { MathText } from '@/components/MathText'
import { PracticeGraph } from '@/components/PracticeGraph'
import {
  generatePracticeTask,
  PRACTICE_LEVELS,
  type PracticeLevel,
} from '@/data/practiceGenerators'
import { topics, type Topic } from '@/data/tasks'
import { normalizeAnswer } from '@/utils/normalizeAnswer'

const GENERATED_STORAGE_KEY = 'retake-trainer-generated-v1'

type PracticeStatus = 'idle' | 'correct' | 'wrong' | 'empty'

function loadSolved() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(GENERATED_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function hasSolved(keys: string[], sourceId: string, level: PracticeLevel) {
  return keys.some((key) => key.startsWith(`generated-${sourceId}-${level}-`))
}

function newSeed(except?: number) {
  let seed = Math.floor(Math.random() * 899999) + 100000
  if (seed === except) seed += 1
  return seed
}

export function PracticeLab() {
  const [topic, setTopic] = useState<Topic>('Производная')
  const [sourceId, setSourceId] = useState('v1-01')
  const [level, setLevel] = useState<PracticeLevel>('base')
  const [seed, setSeed] = useState(() => newSeed())
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<PracticeStatus>('idle')
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [solvedKeys, setSolvedKeys] = useState<string[]>(loadSolved)

  const topicSources = useMemo(() => {
    const ids = new Set(topics.find((item) => item.name === topic)?.taskIds ?? [])
    return Array.from(ids).sort()
  }, [topic])

  const task = useMemo(() => generatePracticeTask(sourceId, level, seed), [sourceId, level, seed])
  const levelSolved = hasSolved(solvedKeys, sourceId, level)
  const isMastered = (id: string) => PRACTICE_LEVELS.every((item) => hasSolved(solvedKeys, id, item.id))
  const masteredCount = useMemo(
    () => topics.reduce((sum, item) => sum + item.taskIds.filter(isMastered).length, 0),
    // solvedKeys is the only changing input; isMastered is intentionally evaluated for the current progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solvedKeys],
  )
  const completedLevels = useMemo(
    () => topics.reduce(
      (sum, item) => sum + item.taskIds.reduce(
        (inner, id) => inner + PRACTICE_LEVELS.filter((practiceLevel) => hasSolved(solvedKeys, id, practiceLevel.id)).length,
        0,
      ),
      0,
    ),
    [solvedKeys],
  )
  const topicMastered = topicSources.filter(isMastered).length
  const currentTypeSolved = PRACTICE_LEVELS.filter((item) => hasSolved(solvedKeys, sourceId, item.id)).length

  useEffect(() => {
    localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(solvedKeys))
  }, [solvedKeys])

  useEffect(() => {
    const reset = () => {
      setSolvedKeys([])
      setAnswer('')
      setStatus('idle')
      setShowHint(false)
      setShowSolution(false)
    }
    window.addEventListener('retake-reset', reset)
    return () => window.removeEventListener('retake-reset', reset)
  }, [])

  const clearAttempt = () => {
    setAnswer('')
    setStatus('idle')
    setShowHint(false)
    setShowSolution(false)
  }

  const selectTopic = (nextTopic: Topic) => {
    const nextIds = topics.find((item) => item.name === nextTopic)?.taskIds ?? []
    setTopic(nextTopic)
    if (nextIds.length) setSourceId(nextIds[0])
    setSeed(newSeed(seed))
    clearAttempt()
  }

  const selectLevel = (nextLevel: PracticeLevel) => {
    setLevel(nextLevel)
    clearAttempt()
  }

  const changeNumbers = () => {
    setSeed(newSeed(seed))
    clearAttempt()
  }

  const check = (event: React.FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) {
      setStatus('empty')
      return
    }
    const correct = task.accepted.some((accepted) => normalizeAnswer(answer) === normalizeAnswer(accepted))
    setStatus(correct ? 'correct' : 'wrong')
    if (correct) {
      setSolvedKeys((previous) => previous.includes(task.id) ? previous : [...previous, task.id])
    }
  }

  return (
    <section className="practice-section" id="practice" aria-labelledby="practice-title">
      <div className="practice-heading">
        <div>
          <p className="section-label">Новые варианты · одна и та же идея</p>
          <h2 id="practice-title">Тренировка темы</h2>
        </div>
        <div className="practice-heading-copy">
          <p>Выбирай тип и меняй числа сколько нужно. На каждом уровне меняются данные, а метод остаётся узнаваемым: сначала понять, затем решить без подсказки.</p>
          <div className="mastery-summary">
            <div><strong>{masteredCount}/40</strong><span>типов освоено</span></div>
            <div className="mastery-track" aria-hidden="true"><span style={{ width: `${masteredCount / 40 * 100}%` }} /></div>
            <small>{completedLevels}/120 уровней закрыто · прогресс сохраняется в этом браузере</small>
          </div>
        </div>
      </div>

      <div className="practice-rule">
        <Target size={22} aria-hidden="true" />
        <p><strong>Как засчитывается тип:</strong> реши хотя бы по одному новому варианту на уровнях «База», «Пересдача» и «Усложнение». Если ошибся — разбери метод, смени числа и попробуй снова.</p>
      </div>

      <div className="practice-layout">
        <aside className="practice-topic-panel" aria-label="Выбор темы для генерации">
          <span className="practice-panel-label">1. Выбери тему</span>
          <div className="practice-topic-list">
            {topics.map((item) => {
              const count = item.taskIds.filter(isMastered).length
              return (
                <button
                  type="button"
                  key={item.name}
                  className={topic === item.name ? 'active' : ''}
                  onClick={() => selectTopic(item.name)}
                  aria-pressed={topic === item.name}
                >
                  <span>{item.name}</span>
                  <small>{count}/{item.taskIds.length}</small>
                </button>
              )
            })}
          </div>
          <p className="practice-topic-note">В теме «{topic}» освоено {topicMastered} из {topicSources.length} типов. Число рядом — не количество нажатий, а действительно закрытые типы.</p>
        </aside>

        <div className="practice-workspace">
          <div className="practice-controls">
            <label htmlFor="practice-source">2. Выбери тип задачи</label>
            <select
              id="practice-source"
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value)
                setSeed(newSeed(seed))
                clearAttempt()
              }}
            >
              {topicSources.map((id) => {
                const sourceTask = generatePracticeTask(id, 'base', 1)
                return <option value={id} key={id}>{id === 'v1-16' ? 'Задача с параметром' : sourceTask.title} · вариант {sourceTask.variant}</option>
              })}
            </select>
            <div className="practice-levels" aria-label="Уровень сложности">
              {PRACTICE_LEVELS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={level === item.id ? 'active' : ''}
                  onClick={() => selectLevel(item.id)}
                  aria-pressed={level === item.id}
                >
                  {hasSolved(solvedKeys, sourceId, item.id) && <Check size={15} aria-hidden="true" />}
                  {item.label}
                </button>
              ))}
            </div>
            <p className="practice-level-description">{PRACTICE_LEVELS.find((item) => item.id === level)?.description}</p>
          </div>

          <article className="generated-task" aria-labelledby="generated-title">
            <div className="task-meta">
              <span>Новый вариант · уровень «{PRACTICE_LEVELS.find((item) => item.id === level)?.label}»</span>
              <span>{levelSolved ? 'Уровень уже закрыт' : 'Уровень ещё не закрыт'}</span>
            </div>
            <p className="task-topic">{task.topic} · вариант {task.variant}</p>
            <h3 id="generated-title">{task.title}</h3>
            <div className="task-formula"><MathText math={task.prompt} block /></div>
            {task.graphSpec && <PracticeGraph spec={task.graphSpec} />}

            <form className="answer-form" onSubmit={check}>
              <label htmlFor="generated-answer">Твой ответ</label>
              <div className="answer-row">
                <input
                  id="generated-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Число, интервал или несколько значений"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="generated-format generated-feedback"
                />
                <button className="check-button" type="submit">Проверить <ArrowRight size={18} aria-hidden="true" /></button>
              </div>
              <p className="format-note" id="generated-format">{task.answerFormat}</p>
              <div className="feedback-region" id="generated-feedback" aria-live="polite">
                {status === 'correct' && (
                  <div className="feedback correct-feedback">
                    <CheckCircle2 size={22} aria-hidden="true" />
                    <div><strong>Верно. Этот вариант засчитан.</strong><p>{currentTypeSolved === 3 ? 'Тип освоен на всех уровнях. Можно возвращаться для повторения.' : `Закрыто ${currentTypeSolved} из 3 уровней этого типа. Продолжай без спешки.`}</p></div>
                  </div>
                )}
                {status === 'wrong' && (
                  <div className="feedback wrong-feedback">
                    <XCircle size={22} aria-hidden="true" />
                    <div><strong>Пока не совпадает. Это нормальная часть тренировки.</strong><p>Проверь вычисления, возьми подсказку или разбор. Затем смени числа — ответ лучше не запоминать, а выводить заново.</p></div>
                  </div>
                )}
                {status === 'empty' && <p className="empty-feedback">Сначала запиши ответ. Даже предположение помогает увидеть, на каком шаге возник вопрос.</p>}
              </div>
            </form>

            <div className="help-actions">
              <button type="button" onClick={changeNumbers}><Dices size={18} aria-hidden="true" /> Сменить числа</button>
              <button type="button" onClick={() => setShowHint((value) => !value)} aria-expanded={showHint} aria-controls="generated-hint"><Lightbulb size={18} aria-hidden="true" /> {showHint ? 'Скрыть подсказку' : 'Подсказка'}</button>
              <button type="button" onClick={() => setShowSolution((value) => !value)} aria-expanded={showSolution} aria-controls="generated-solution"><ListChecks size={18} aria-hidden="true" /> {showSolution ? 'Скрыть разбор' : 'Показать разбор'}</button>
            </div>

            {showHint && <div className="hint-panel" id="generated-hint"><span>Опора для решения</span><p>{task.hint}</p></div>}
            {showSolution && (
              <div className="solution-panel" id="generated-solution">
                <div className="solution-heading">Решение по шагам <RotateCcw size={18} aria-hidden="true" /></div>
                <ol>
                  {task.steps.map((step, index) => (
                    <li key={index}><span>{index + 1}</span><div><p>{step.text}</p><MathText math={step.math} block /></div></li>
                  ))}
                </ol>
                <div className="solution-answer"><strong>Ответ</strong><MathText math={task.answer} block /></div>
                <p className="mistake-note"><strong>Типичная ошибка:</strong> {task.mistake}</p>
              </div>
            )}

            <div className="generated-progress">
              <div className="generated-level-dots">
                {PRACTICE_LEVELS.map((item) => (
                  <span className={hasSolved(solvedKeys, sourceId, item.id) ? 'done' : ''} key={item.id}>
                    {hasSolved(solvedKeys, sourceId, item.id) ? <Check size={14} aria-hidden="true" /> : null}{item.label}
                  </span>
                ))}
              </div>
              <p>{isMastered(sourceId) ? 'Тип освоен на всех уровнях. Можно возвращаться для повторения.' : 'Кнопка «Сменить числа» создаёт другой вариант этого же типа с пересчитанным решением.'}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
