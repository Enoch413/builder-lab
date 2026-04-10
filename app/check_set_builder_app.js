const CHECK_QUESTION_TYPES = ['객관식', '주관식']
const CHECK_PROBLEM_TYPES = [
  '주제',
  '제목',
  '주장',
  '요지',
  '목적',
  '요약',
  '내용일치',
  '함축의미',
  '지칭',
  '심경',
  '빈칸',
  '빈칸(주관식)',
  '연결사',
  '연결사(주관식)',
  '꼬리문제',
  '주관식',
  '영작',
  '요약(주관식)',
  '어법',
  '어법(주관식)',
  '어휘',
  '배열',
  '기타주관식',
  '무관',
  '무관문',
  '순서',
  '삽입',
  '밑줄어법',
  '밑줄어휘',
  '선택어휘',
  '선택어법',
  '기타'
]
const CHECK_PROBLEM_TYPE_ALIAS_MAP = new Map([
  ...CHECK_PROBLEM_TYPES.map(function(type){
    return [normalizeProblemTypeToken(type), type]
  }),
  ['내용과일치', '내용일치'],
  ['답할수없는질문', '내용일치'],
  ['한문장요약', '요약'],
  ['서술형', '주관식'],
  ['영작문', '영작'],
  ['요약주관식', '요약(주관식)'],
  ['가리키는대상', '지칭'],
  ['가리키는것', '지칭'],
  ['지칭하는대상', '지칭'],
  ['어조', '심경'],
  ['필자의어조', '심경'],
  ['문법적쓰임', '밑줄어법'],
  ['함축', '함축의미']
])
const CHOICE_SYMBOL_MAP = {
  '①': '1',
  '②': '2',
  '③': '3',
  '④': '4',
  '⑤': '5'
}

let checkSetState = createEmptyCheckSet()
let checkSetIdTouched = false

const loadSetBtn = document.getElementById('load-set-btn')
const setFileInput = document.getElementById('set-file-input')
const downloadSetBtn = document.getElementById('download-set-btn')
const generateQuestionsBtn = document.getElementById('generate-questions-btn')
const answerTextInput = document.getElementById('answer-text-input')
const applyAnswerTextBtn = document.getElementById('apply-answer-text-btn')
const clearAnswerTextBtn = document.getElementById('clear-answer-text-btn')
const loadProblemTypePdfBtn = document.getElementById('load-problem-type-pdf-btn')
const problemTypePdfInput = document.getElementById('problem-type-pdf-input')
const problemTypeImportStatus = document.getElementById('problem-type-import-status')
const objectiveCountInput = document.getElementById('objective-count')
const subjectiveCountInput = document.getElementById('subjective-count')
const questionStartNumberInput = document.getElementById('question-start-number')
const setTitleInput = document.getElementById('set-title')
const setIdInput = document.getElementById('set-id')
const setDescriptionInput = document.getElementById('set-description')
const questionSummary = document.getElementById('question-summary')
const questionList = document.getElementById('question-list')
const downloadFileName = document.getElementById('download-file-name')

loadSetBtn.addEventListener('click', function(){
  setFileInput.click()
})
setFileInput.addEventListener('change', handleSetFileLoad)
downloadSetBtn.addEventListener('click', downloadCurrentSet)
generateQuestionsBtn.addEventListener('click', generateQuestionsByCount)
applyAnswerTextBtn.addEventListener('click', applyAnswerTextImport)
clearAnswerTextBtn.addEventListener('click', function(){
  answerTextInput.value = ''
})
loadProblemTypePdfBtn.addEventListener('click', function(){
  problemTypePdfInput.click()
})
problemTypePdfInput.addEventListener('change', handleProblemTypePdfLoad)
if(questionStartNumberInput){
  questionStartNumberInput.addEventListener('input', function(event){
    checkSetState.startNumber = normalizeQuestionNumber(event.target.value, 1)
  })
}
setTitleInput.addEventListener('input', function(event){
  checkSetState.title = event.target.value
  if(!checkSetIdTouched){
    checkSetState.id = buildCheckSlug(event.target.value) || 'check-set'
  }
  syncMetaFields()
})
setIdInput.addEventListener('input', function(event){
  checkSetIdTouched = true
  checkSetState.id = buildCheckSlug(event.target.value, true)
  syncMetaFields()
})
setDescriptionInput.addEventListener('input', function(event){
  checkSetState.description = event.target.value
})

if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions){
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
}

renderCheckSetBuilder()

function createEmptyCheckSet(){
  return {
    id: 'check-set',
    title: '',
    description: '',
    startNumber: 1,
    questions: []
  }
}

function createQuestionState(index, source){
  const info = source || {}
  const type = normalizeQuestionType(info.type)
  const number = normalizeQuestionNumber(info.number, index + 1)
  return {
    number: number,
    type: type,
    problemType: normalizeProblemType(info.problemType || info.category || info.questionCategory),
    answer: normalizeStoredAnswer(info.answer, type),
    explanation: String(info.explanation || '').trim()
  }
}

function renderCheckSetBuilder(){
  syncMetaFields()
  renderQuestions()
  updateCheckSetSummary()
}

function syncMetaFields(){
  setTitleInput.value = checkSetState.title
  setIdInput.value = checkSetState.id
  setDescriptionInput.value = checkSetState.description
  if(questionStartNumberInput){
    questionStartNumberInput.value = String(normalizeQuestionNumber(checkSetState.startNumber, 1))
  }
  downloadFileName.textContent = (checkSetState.id || 'check-set') + '.json'
}

function updateCheckSetSummary(){
  const objectiveCount = checkSetState.questions.filter(function(question){
    return question.type === '객관식'
  }).length
  const subjectiveCount = checkSetState.questions.filter(function(question){
    return question.type === '주관식'
  }).length

  questionSummary.textContent = '총 ' + checkSetState.questions.length + '문항'

  const summaryNote = document.getElementById('set-summary-note')
  if(summaryNote){
    summaryNote.innerHTML =
      '<strong>저장 파일명:</strong> <span id="download-file-name">' + escapeHtml((checkSetState.id || 'check-set') + '.json') + '</span><br>' +
      '<strong>문항 구성:</strong> 객관식 ' + objectiveCount + ' / 주관식 ' + subjectiveCount
  }
}

function renderQuestions(){
  if(!checkSetState.questions.length){
    questionList.innerHTML = '<div class="empty">왼쪽에서 문항 자동 생성이나 기존 세트 불러오기를 실행하면 여기서 바로 편집할 수 있습니다.</div>'
    return
  }

  questionList.innerHTML = checkSetState.questions.map(function(question, index){
    return '' +
      '<article class="question-card" data-question-index="' + index + '">' +
        '<div class="question-head">' +
          '<div class="question-title">' +
            '<strong>문항 ' + normalizeQuestionNumber(question.number, index + 1) + '</strong>' +
            '<span>' + escapeHtml(getQuestionHelpText(question.type)) + '</span>' +
          '</div>' +
          '<div class="question-actions">' +
            '<button class="btn btn-light" type="button" data-action="move-up">위로</button>' +
            '<button class="btn btn-light" type="button" data-action="move-down">아래로</button>' +
            '<button class="btn btn-danger" type="button" data-action="remove">삭제</button>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>문항 유형</label>' +
          '<div class="type-choice-grid">' +
            CHECK_QUESTION_TYPES.map(function(type){
              const activeClass = question.type === type ? ' active' : ''
              return '<button class="type-choice-btn' + activeClass + '" type="button" data-action="set-type" data-value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</button>'
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:14px">' +
          '<label>문제 유형</label>' +
          '<select data-field="problemType">' +
            CHECK_PROBLEM_TYPES.map(function(type){
              const selected = question.problemType === type ? ' selected' : ''
              return '<option value="' + escapeHtml(type) + '"' + selected + '>' + escapeHtml(type) + '</option>'
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field" style="margin-top:14px">' +
          '<label>정답</label>' +
          renderAnswerEditor(question) +
        '</div>' +
        '<div class="field" style="margin-top:14px">' +
          '<label>해설</label>' +
          '<textarea data-field="explanation" placeholder="학생 제출 후 보여줄 해설을 입력하세요.">' + escapeHtml(question.explanation) + '</textarea>' +
        '</div>' +
      '</article>'
  }).join('')

  questionList.querySelectorAll('[data-action]').forEach(function(button){
    button.addEventListener('click', onQuestionAction)
  })
  questionList.querySelectorAll('[data-field]').forEach(function(field){
    field.addEventListener('input', onQuestionFieldInput)
    field.addEventListener('change', onQuestionFieldInput)
  })
}

function renderAnswerEditor(question){
  if(question.type === '주관식'){
    return '' +
      '<textarea data-field="answer" placeholder="모범 답안 또는 기준 답안을 입력하세요.">' + escapeHtml(question.answer) + '</textarea>' +
      '<div class="subjective-note">학생은 답지를 보고 <strong>맞음 / 틀림</strong>만 체크하지만, 여기 입력한 답안은 결과 화면과 답지 자동 채우기에 같이 사용됩니다.</div>'
  }

  return '' +
    '<div class="answer-choice-grid">' +
      [1, 2, 3, 4, 5].map(function(choice){
        const value = String(choice)
        const activeClass = question.answer === value ? ' active' : ''
        return '<button class="answer-choice-btn' + activeClass + '" type="button" data-action="set-answer" data-value="' + value + '">' + value + '</button>'
      }).join('') +
    '</div>'
}

function onQuestionAction(event){
  const card = event.target.closest('[data-question-index]')
  if(!card) return

  const index = Number(card.dataset.questionIndex)
  const action = event.target.dataset.action
  const question = checkSetState.questions[index]
  if(!question) return

  if(action === 'set-type'){
    const nextType = normalizeQuestionType(event.target.dataset.value)
    if(question.type !== nextType){
      question.type = nextType
      question.answer = normalizeStoredAnswer(question.answer, nextType)
    }
    renderCheckSetBuilder()
    return
  }

  if(action === 'set-answer'){
    question.answer = normalizeChoiceAnswer(event.target.dataset.value)
    renderCheckSetBuilder()
    return
  }

  if(action === 'remove'){
    if(checkSetState.questions.length === 1){
      window.alert('CHECK 세트에는 최소 1문항이 필요합니다.')
      return
    }
    checkSetState.questions.splice(index, 1)
  }else if(action === 'move-up' && index > 0){
    swapQuestions(index, index - 1)
  }else if(action === 'move-down' && index < checkSetState.questions.length - 1){
    swapQuestions(index, index + 1)
  }

  renderCheckSetBuilder()
}

function onQuestionFieldInput(event){
  const card = event.target.closest('[data-question-index]')
  if(!card) return

  const index = Number(card.dataset.questionIndex)
  const fieldName = event.target.dataset.field
  const question = checkSetState.questions[index]
  if(!question) return

  if(fieldName === 'answer'){
    question.answer = normalizeStoredAnswer(event.target.value, question.type)
    if(question.type === '객관식') event.target.value = question.answer
    return
  }

  question[fieldName] = event.target.value
}

function swapQuestions(sourceIndex, targetIndex){
  const current = checkSetState.questions[sourceIndex]
  checkSetState.questions[sourceIndex] = checkSetState.questions[targetIndex]
  checkSetState.questions[targetIndex] = current
}

function handleSetFileLoad(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  const reader = new FileReader()
  reader.onload = function(loadEvent){
    try{
      const data = JSON.parse(loadEvent.target.result)
      const nextState = normalizeCheckSetForBuilder(data)
      checkSetState = nextState
      checkSetIdTouched = Boolean(nextState.id)
      renderCheckSetBuilder()
      updateSetStatus(file.name + ' 파일을 불러와 수정 모드로 전환했습니다.')
    }catch(error){
      window.alert('읽을 수 없는 CHECK 세트 JSON입니다.')
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

function normalizeCheckSetForBuilder(source){
  if(!source || !Array.isArray(source.questions)) throw new Error('INVALID_CHECK_SET')

  const title = String(source.title || '').trim()
  const id = buildCheckSlug(source.id || title || 'check-set', true) || 'check-set'
  const questions = source.questions.map(function(question, index){
    return createQuestionState(index, question)
  }).filter(function(question){
    return question.answer || question.explanation
  })

  if(!questions.length) throw new Error('EMPTY_QUESTIONS')

  return {
    id: id,
    title: title,
    description: String(source.description || '').trim(),
    startNumber: questions[0] ? normalizeQuestionNumber(questions[0].number, 1) : 1,
    questions: questions
  }
}

function downloadCurrentSet(){
  const title = String(checkSetState.title || '').trim()
  const setId = buildCheckSlug(checkSetState.id || title || 'check-set', true) || 'check-set'
  const description = String(checkSetState.description || '').trim()

  const questions = checkSetState.questions.map(function(question, index){
    const type = normalizeQuestionType(question.type)
    const number = normalizeQuestionNumber(question.number, index + 1)
    return {
      id: 'q' + number,
      number: number,
      type: type,
      problemType: normalizeProblemType(question.problemType),
      prompt: '문항 ' + number,
      answer: normalizeStoredAnswer(question.answer, type),
      acceptableAnswers: [],
      explanation: String(question.explanation || '').trim()
    }
  }).filter(function(question){
    return question.answer || question.explanation
  })

  if(!title){
    window.alert('세트 제목을 입력해 주세요.')
    setTitleInput.focus()
    return
  }
  if(!questions.length){
    window.alert('최소 1문항 이상 입력해 주세요.')
    return
  }

  const invalidQuestion = questions.findIndex(function(question){
    if(question.type === '객관식') return !normalizeChoiceAnswer(question.answer)
    return false
  })
  if(invalidQuestion >= 0){
    const invalidNumber = questions[invalidQuestion] ? normalizeQuestionNumber(questions[invalidQuestion].number, invalidQuestion + 1) : (invalidQuestion + 1)
    window.alert('문항 ' + invalidNumber + '번의 정답을 입력해 주세요.')
    return
  }

  checkSetState.id = setId
  syncMetaFields()

  const payload = {
    kind: 'check-set',
    savedAt: new Date().toISOString(),
    id: setId,
    title: title,
    description: description,
    questions: questions
  }

  downloadJsonFile(setId + '.json', payload)
  updateSetStatus('"' + title + '" 세트 JSON을 다운로드했습니다.')
}

function applyAnswerTextImport(){
  const entries = parseAnswerTextEntries(answerTextInput.value)
  if(!entries.length){
    window.alert('답지 텍스트에서 인식된 문항이 없습니다. `1번 / 답: / 해설:` 형식을 확인해 주세요.')
    return
  }

  if(!hasConfiguredQuestions()){
    checkSetState.questions = []
  }

  let createdCount = 0
  entries.forEach(function(entry){
    const question = ensureQuestionByNumber(entry.number, entry.inferredType)
    if(!question._existing) createdCount += 1
    delete question._existing
    question.number = entry.number
    question.type = entry.inferredType
    question.answer = normalizeStoredAnswer(entry.answer, entry.inferredType)
    question.explanation = entry.explanation
  })

  sortQuestionsByNumber()
  refreshStartNumberFromQuestions()
  renderCheckSetBuilder()
  updateSetStatus('답지 텍스트에서 ' + entries.length + '개 문항을 인식해 자동 반영했습니다.' + (createdCount ? ' 새 문항 ' + createdCount + '개도 함께 만들었습니다.' : ''))
}

function parseAnswerTextEntries(rawText){
  const text = normalizeImportedText(rawText)
  if(!text) return []
  const entries = []
  const lines = text.split('\n')
  let currentEntry = null

  function flushCurrentEntry(){
    if(!(currentEntry && currentEntry.number)) return
    const parsed = parseAnswerTextBlock(currentEntry.lines)
    if(!(parsed.answer || parsed.explanation)) return
    entries.push({
      number: normalizeQuestionNumber(currentEntry.number, entries.length + 1),
      answer: parsed.answer,
      explanation: parsed.explanation,
      inferredType: inferQuestionTypeFromAnswer(parsed.answer)
    })
  }

  lines.forEach(function(line){
    const trimmed = line.trim()
    const numberMatch = trimmed.match(/^(\d{1,3})\s*번(?:\s*[.)\-:：])?\s*(.*)$/)
    if(numberMatch){
      flushCurrentEntry()
      currentEntry = {
        number: Number(numberMatch[1]),
        lines: []
      }
      if(numberMatch[2]) currentEntry.lines.push(numberMatch[2])
      return
    }
    if(currentEntry) currentEntry.lines.push(line)
  })

  flushCurrentEntry()

  return entries
}

function parseAnswerTextBlock(blockText){
  const lines = Array.isArray(blockText)
    ? blockText
    : normalizeImportedText(blockText).split('\n')
  let answer = ''
  const explanationLines = []
  let currentField = ''

  lines.forEach(function(line){
    const trimmed = line.trim()
    if(!trimmed){
      if(currentField === 'explanation' && explanationLines.length && explanationLines[explanationLines.length - 1] !== ''){
        explanationLines.push('')
      }
      return
    }

    const answerMatch = trimmed.match(/^(?:답|정답)\s*[:：]?\s*(.*)$/)
    if(answerMatch){
      const nextAnswer = answerMatch[1].trim()
      answer = nextAnswer || answer
      currentField = nextAnswer ? '' : 'answer'
      return
    }

    const explanationMatch = trimmed.match(/^해설\s*[:：]\s*(.*)$/)
    if(explanationMatch){
      const firstLine = explanationMatch[1].trim()
      if(firstLine) explanationLines.push(firstLine)
      currentField = 'explanation'
      return
    }

    if(currentField === 'explanation'){
      explanationLines.push(trimmed)
      return
    }

    if(currentField === 'answer' && !answer){
      answer = trimmed
      currentField = ''
    }
  })

  return {
    answer: answer.trim(),
    explanation: explanationLines.join('\n').trim()
  }
}

function normalizeImportedText(value){
  return String(value || '')
    .replace(/\uFEFF/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200D\u202F\u205F\u3000]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
}

async function handleProblemTypePdfLoad(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  try{
    const matches = await extractProblemTypesFromPdf(file)
    const applied = applyProblemTypeMatches(matches)
    setProblemTypeImportStatus(file.name + '에서 문제유형 ' + matches.totalDetected + '개를 읽어 ' + applied.appliedCount + '개 문항에 반영했습니다.' + (applied.createdCount ? ' 새 문항 ' + applied.createdCount + '개를 함께 만들었습니다.' : ''), false)
  }catch(error){
    console.error(error)
    setProblemTypeImportStatus((error && error.message) ? error.message : '문제유형 PDF를 읽지 못했습니다.', true)
  }finally{
    event.target.value = ''
  }
}

async function extractProblemTypesFromPdf(file){
  if(!(window.pdfjsLib && window.pdfjsLib.getDocument)){
    throw new Error('PDF 읽기 라이브러리를 불러오지 못했습니다.')
  }

  const buffer = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise
  const numbered = new Map()
  const ordered = []

  for(let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1){
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const lines = buildPdfLines(textContent.items || [])
    const tokenMatches = extractNumberedProblemTypesFromLines(lines)
    tokenMatches.forEach(function(match){
      if(!numbered.has(match.number)) numbered.set(match.number, match.type)
    })

    const descriptors = lines.map(function(line){
      return {
        line: line,
        number: extractQuestionNumberFromText(line),
        inlineType: detectProblemTypeFromText(line),
        standaloneType: detectStandaloneProblemType(line)
      }
    })
    const pageNumbers = []
    const pageStandaloneTypes = []

    descriptors.forEach(function(descriptor, index){
      const previousDescriptor = descriptors[index - 1]
      const nextDescriptor = descriptors[index + 1]

      if(descriptor.number && descriptor.inlineType){
        if(!numbered.has(descriptor.number)) numbered.set(descriptor.number, descriptor.inlineType)
        return
      }

      if(descriptor.number){
        pageNumbers.push(descriptor.number)
      }

      if(descriptor.number && nextDescriptor && nextDescriptor.standaloneType){
        if(!numbered.has(descriptor.number)) numbered.set(descriptor.number, nextDescriptor.standaloneType)
        return
      }

      if(descriptor.standaloneType && previousDescriptor && previousDescriptor.number && !previousDescriptor.inlineType){
        if(!numbered.has(previousDescriptor.number)) numbered.set(previousDescriptor.number, descriptor.standaloneType)
        return
      }

      if(descriptor.standaloneType){
        pageStandaloneTypes.push(descriptor.standaloneType)
      }
    })

    const unpairedNumbers = pageNumbers.filter(function(number){
      return !numbered.has(number)
    })
    if(unpairedNumbers.length && pageStandaloneTypes.length){
      const pairCount = Math.min(unpairedNumbers.length, pageStandaloneTypes.length)
      for(let index = 0; index < pairCount; index += 1){
        if(!numbered.has(unpairedNumbers[index])){
          numbered.set(unpairedNumbers[index], pageStandaloneTypes[index])
        }
      }
    }else if(!pageNumbers.length && pageStandaloneTypes.length){
      pageStandaloneTypes.forEach(function(type){
        ordered.push(type)
      })
    }
  }

  const totalDetected = numbered.size + ordered.length
  if(!totalDetected){
    throw new Error('PDF에서 인식된 문제유형이 없습니다. PDF 안에 번호와 유형 텍스트가 실제로 들어 있는지 확인해 주세요.')
  }

  return {
    numbered: numbered,
    ordered: ordered,
    totalDetected: totalDetected
  }
}

function buildPdfLines(items){
  const rows = []

  items.forEach(function(item){
    const text = String(item && item.str || '').trim()
    if(!text) return

    const x = Number(item.transform && item.transform[4] || 0)
    const y = Number(item.transform && item.transform[5] || 0)
    let row = rows.find(function(entry){
      return Math.abs(entry.y - y) < 2.2
    })
    if(!row){
      row = { y: y, items: [] }
      rows.push(row)
    }
    row.items.push({ x: x, text: text })
  })

  return rows
    .sort(function(a, b){ return b.y - a.y })
    .map(function(row){
      return row.items
        .sort(function(left, right){ return left.x - right.x })
        .map(function(item){ return item.text })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    })
    .filter(Boolean)
}

function detectProblemTypeFromText(text){
  const rawText = String(text || '').trim()
  if(!extractQuestionNumberFromText(rawText) && /(?:객관식|주관식|영작|어법|어휘)\s*\d/.test(rawText)){
    return ''
  }

  const token = normalizeProblemTypeToken(rawText)
  return detectProblemTypeFromToken(token)
}

function detectProblemTypeFromToken(token){
  if(!token) return ''

  const matches = []
  CHECK_PROBLEM_TYPE_ALIAS_MAP.forEach(function(type, alias){
    if(token.indexOf(alias) === -1) return
    matches.push({ type: type, alias: alias })
  })
  if(!matches.length) return ''

  matches.sort(function(left, right){
    return right.alias.length - left.alias.length
  })
  return matches[0].type
}

function detectStandaloneProblemType(text){
  const token = normalizeProblemTypeToken(text)
  if(!token) return ''

  const matches = []
  CHECK_PROBLEM_TYPE_ALIAS_MAP.forEach(function(type, alias){
    if(token !== alias && token !== alias + '문제' && token !== alias + '유형') return
    matches.push({ type: type, alias: alias })
  })
  if(!matches.length) return ''

  matches.sort(function(left, right){
    return right.alias.length - left.alias.length
  })
  return matches[0].type
}

function extractNumberedProblemTypesFromLines(lines){
  const tokenText = normalizeProblemTypeToken((lines || []).join(' '))
  if(!tokenText) return []

  const results = []
  const pattern = /문항(\d{1,3})(.*?)(?=문항\d{1,3}|$)/g
  let match = pattern.exec(tokenText)
  while(match){
    const number = normalizeQuestionNumber(match[1], 1)
    const segment = String(match[2] || '')
    const type = detectProblemTypeFromToken(segment)
    if(number && type){
      results.push({ number: number, type: type })
    }
    match = pattern.exec(tokenText)
  }
  return results
}

function extractQuestionNumberFromText(text){
  const directMatch = String(text || '').match(/(?:^|\s)(\d{1,3})\s*번/)
  if(directMatch) return normalizeQuestionNumber(directMatch[1], 1)
  const altMatch = String(text || '').match(/^(\d{1,3})\s*[\.\)]/)
  return altMatch ? normalizeQuestionNumber(altMatch[1], 1) : 0
}

function applyProblemTypeMatches(result){
  let createdCount = 0
  let appliedCount = 0
  const hasExistingConfiguredEntries = hasConfiguredQuestions()

  result.numbered.forEach(function(type, number){
    const question = hasExistingConfiguredEntries
      ? findQuestionByNumber(number)
      : ensureQuestionByNumber(number, getAutoQuestionTypeFromProblemType(type))
    if(!question) return
    if(!hasExistingConfiguredEntries && !question._existing) createdCount += 1
    delete question._existing
    applyImportedProblemTypeToQuestion(question, type)
    appliedCount += 1
  })

  if(!hasExistingConfiguredEntries && result.ordered.length){
    const startNumber = normalizeQuestionNumber(checkSetState.startNumber, 1)
    for(let index = 0; index < result.ordered.length; index += 1){
      const question = ensureQuestionByNumber(startNumber + index, getAutoQuestionTypeFromProblemType(result.ordered[index]))
      if(!question._existing) createdCount += 1
      delete question._existing
    }
  }

  if(result.ordered.length){
    const availableQuestions = checkSetState.questions
      .slice()
      .sort(function(left, right){
        return normalizeQuestionNumber(left.number, 1) - normalizeQuestionNumber(right.number, 1)
      })
      .filter(function(question){
        return !result.numbered.has(normalizeQuestionNumber(question.number, 1))
      })

    result.ordered.forEach(function(type, index){
      const question = availableQuestions[index]
      if(!question) return
      applyImportedProblemTypeToQuestion(question, type)
      appliedCount += 1
    })
  }

  sortQuestionsByNumber()
  refreshStartNumberFromQuestions()
  renderCheckSetBuilder()

  return {
    createdCount: createdCount,
    appliedCount: appliedCount
  }
}

function findQuestionByNumber(number){
  const normalizedNumber = normalizeQuestionNumber(number, 1)
  return checkSetState.questions.find(function(question){
    return normalizeQuestionNumber(question.number, 1) === normalizedNumber
  }) || null
}

function ensureQuestionByNumber(number, fallbackType){
  const normalizedNumber = normalizeQuestionNumber(number, 1)
  const existing = findQuestionByNumber(normalizedNumber)
  if(existing){
    existing._existing = true
    return existing
  }

  const created = createQuestionState(checkSetState.questions.length, {
    number: normalizedNumber,
    type: fallbackType || '객관식'
  })
  created._existing = false
  checkSetState.questions.push(created)
  return created
}

function sortQuestionsByNumber(){
  checkSetState.questions.sort(function(left, right){
    return normalizeQuestionNumber(left.number, 1) - normalizeQuestionNumber(right.number, 1)
  })
}

function refreshStartNumberFromQuestions(){
  if(!checkSetState.questions.length) return
  checkSetState.startNumber = checkSetState.questions.reduce(function(minValue, question, index){
    return Math.min(minValue, normalizeQuestionNumber(question.number, index + 1))
  }, normalizeQuestionNumber(checkSetState.questions[0].number, 1))
}

function setProblemTypeImportStatus(message, isError){
  if(!problemTypeImportStatus) return
  problemTypeImportStatus.innerHTML = '<strong>' + (isError ? '오류:' : '상태:') + '</strong> ' + escapeHtml(message)
}

function updateSetStatus(message){
  return message
}

function applyImportedProblemTypeToQuestion(question, type){
  const normalizedType = normalizeProblemType(type)
  question.problemType = normalizedType
  if(isSubjectiveProblemType(normalizedType)){
    question.type = '주관식'
    question.answer = normalizeStoredAnswer(question.answer, question.type)
  }
}

function normalizeQuestionType(value){
  return String(value || '').trim() === '주관식' ? '주관식' : '객관식'
}

function normalizeProblemType(value){
  const direct = String(value || '').trim()
  const token = normalizeProblemTypeToken(direct)
  return CHECK_PROBLEM_TYPE_ALIAS_MAP.get(token) || (CHECK_PROBLEM_TYPES.includes(direct) ? direct : '기타')
}

function getAutoQuestionTypeFromProblemType(problemType){
  return isSubjectiveProblemType(problemType) ? '주관식' : '객관식'
}

function isSubjectiveProblemType(problemType){
  const normalizedType = normalizeProblemType(problemType)
  if(!normalizedType || normalizedType === '기타') return false
  return normalizedType === '주관식'
    || normalizedType === '영작'
    || normalizedType === '기타주관식'
    || normalizedType.indexOf('(주관식)') !== -1
}

function normalizeProblemTypeToken(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s·•ㆍ:：()\[\]{}<>.,/\\'"!?_\-]+/g, '')
}

function normalizeChoiceAnswer(value){
  const raw = String(value || '').trim()
  const symbolMatch = raw.match(/[①②③④⑤]/)
  if(symbolMatch) return CHOICE_SYMBOL_MAP[symbolMatch[0]] || ''
  const match = raw.match(/[1-5]/)
  return match ? match[0] : ''
}

function normalizeStoredAnswer(value, type){
  const raw = String(value || '').trim()
  return type === '객관식' ? normalizeChoiceAnswer(raw) : raw
}

function inferQuestionTypeFromAnswer(answer){
  const raw = String(answer || '').trim()
  if(!raw) return '객관식'
  if(normalizeChoiceAnswer(raw) && /^[①②③④⑤1-5\s.)]+$/.test(raw)) return '객관식'
  return '주관식'
}

function getQuestionHelpText(type){
  return type === '주관식'
    ? '학생은 답지를 보고 맞음 또는 틀림만 체크합니다.'
    : '학생은 1, 2, 3, 4, 5 중 하나를 선택해 제출합니다.'
}

function generateQuestionsByCount(){
  const objectiveCount = normalizeCountValue(objectiveCountInput.value)
  const subjectiveCount = normalizeCountValue(subjectiveCountInput.value)
  const startNumber = normalizeQuestionNumber(questionStartNumberInput && questionStartNumberInput.value, 1)
  const totalCount = objectiveCount + subjectiveCount

  if(totalCount <= 0){
    window.alert('객관식이나 주관식 문항 수를 1개 이상 입력해 주세요.')
    return
  }

  if(hasConfiguredQuestions()){
    const shouldReplace = window.confirm('현재 작성 중인 문항 구성을 지우고 새 문항 수로 다시 만들까요?')
    if(!shouldReplace) return
  }

  checkSetState.questions = []
  checkSetState.startNumber = startNumber

  for(let index = 0; index < objectiveCount; index += 1){
    checkSetState.questions.push(createQuestionState(checkSetState.questions.length, { type: '객관식', number: startNumber + index }))
  }
  for(let index = 0; index < subjectiveCount; index += 1){
    checkSetState.questions.push(createQuestionState(checkSetState.questions.length, { type: '주관식', number: startNumber + objectiveCount + index }))
  }

  renderCheckSetBuilder()
}

function hasConfiguredQuestions(){
  if(!checkSetState.questions.length) return false
  if(checkSetState.questions.length !== 1) return true
  const first = checkSetState.questions[0]
  if(!first) return false
  return !!(first.answer || first.explanation || first.type !== '객관식')
}

function normalizeCountValue(value){
  const count = Number(value)
  if(!Number.isFinite(count) || count < 0) return 0
  return Math.floor(count)
}

function normalizeQuestionNumber(value, fallback){
  const number = Number(value)
  if(!Number.isFinite(number) || number < 1) return Math.max(1, Number(fallback) || 1)
  return Math.floor(number)
}

function getNextQuestionNumber(){
  if(!checkSetState.questions.length){
    return normalizeQuestionNumber(checkSetState.startNumber, 1)
  }
  const maxNumber = checkSetState.questions.reduce(function(max, question, index){
    return Math.max(max, normalizeQuestionNumber(question.number, index + 1))
  }, 0)
  return maxNumber + 1
}

function buildCheckSlug(value, preserveManual){
  const source = String(value || '').trim()
  if(!source) return ''

  const ascii = source.toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  if(ascii) return ascii
  return preserveManual ? source.replace(/\s+/g, '-') : ''
}

function downloadJsonFile(fileName, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
