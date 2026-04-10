const DEFAULT_CHECK_CLASSES = [
  { id: 'class-1-gangseo-b', name: '1강서B' },
  { id: 'class-2-gangseo-a', name: '2강서A' },
  { id: 'class-1-seonbu', name: '1선부' },
  { id: 'class-3-seonbu', name: '3선부' }
]

let checkMasterState = createEmptyCheckMaster()
let checkMasterImportCounter = 0

const loadMasterBtn = document.getElementById('load-master-btn')
const addSetBtn = document.getElementById('add-set-btn')
const generateBtn = document.getElementById('generate-btn')
const addClassBtn = document.getElementById('add-class-btn')
const masterFileInput = document.getElementById('master-file-input')
const setFileInput = document.getElementById('set-file-input')
const masterStatus = document.getElementById('master-status')
const classList = document.getElementById('class-list')
const setList = document.getElementById('set-list')
const classCount = document.getElementById('class-count')
const setCount = document.getElementById('set-count')
const questionCount = document.getElementById('question-count')

loadMasterBtn.addEventListener('click', function(){
  masterFileInput.click()
})
addSetBtn.addEventListener('click', function(){
  setFileInput.click()
})
generateBtn.addEventListener('click', generateCheckMaster)
addClassBtn.addEventListener('click', function(){
  checkMasterState.classes.push(createCheckClass(checkMasterState.classes.length))
  syncCheckSetClassIds()
  renderCheckMaster()
})
masterFileInput.addEventListener('change', loadExistingCheckMaster)
setFileInput.addEventListener('change', addCheckSetFiles)

renderCheckMaster()

function createEmptyCheckMaster(){
  return {
    classes: DEFAULT_CHECK_CLASSES.map(function(classInfo, index){
      return createCheckClass(index, classInfo)
    }),
    checkSets: []
  }
}

function createCheckClass(index, source){
  const info = source || {}
  const fallback = DEFAULT_CHECK_CLASSES[index] || {}
  if(!info.id && fallback.id) info.id = fallback.id
  if(!info.name && fallback.name) info.name = fallback.name
  return {
    id: String(info.id || fallback.id || ('class-' + (index + 1))).trim() || ('class-' + (index + 1)),
    name: String(info.name || ((index + 1) + '반')).trim() || ((index + 1) + '반')
  }
}

function createCheckMasterSet(source, defaultClassIds){
  const info = source || {}
  const questions = normalizeCheckQuestions(info.questions)
  return {
    id: ensureUniqueCheckSetId(buildCheckMasterSlug(info.id || info.title || ('check-set-' + (++checkMasterImportCounter)), true) || ('check-set-' + checkMasterImportCounter)),
    title: String(info.title || 'CHECK 세트').trim() || 'CHECK 세트',
    description: String(info.description || '').trim(),
    availableFrom: String(info.availableFrom || '').trim(),
    availableTo: String(info.availableTo || '').trim(),
    classIds: Array.isArray(info.classIds) && info.classIds.length
      ? info.classIds.map(function(classId){ return String(classId || '').trim() }).filter(Boolean)
      : defaultClassIds.slice(),
    questions: questions
  }
}

function normalizeCheckQuestions(sourceQuestions){
  return (Array.isArray(sourceQuestions) ? sourceQuestions : []).map(function(question, index){
    const type = normalizeCheckQuestionType(question && question.type)
    const number = normalizeCheckQuestionNumber(question && question.number, index + 1)
    return {
      id: String(question && question.id || ('q' + number)).trim() || ('q' + number),
      number: number,
      type: type,
      problemType: normalizeCheckProblemType(question && (question.problemType || question.category || question.questionCategory)),
      prompt: String(question && question.prompt || ('문항 ' + number)).trim() || ('문항 ' + number),
      answer: normalizeCheckAnswerByType(type, question && question.answer),
      acceptableAnswers: normalizeCheckAcceptableAnswers(type, question && question.acceptableAnswers),
      explanation: String(question && question.explanation || '').trim()
    }
  }).filter(function(question){
    return question.type === '주관식' || question.answer || question.explanation
  })
}

function renderCheckMaster(){
  renderClassRows()
  renderCheckSetCards()
  updateCheckMasterSummary()
}

function renderClassRows(){
  classList.innerHTML = checkMasterState.classes.map(function(classInfo, index){
    return '' +
      '<div class="class-row" data-class-index="' + index + '">' +
        '<div class="field">' +
          '<label>반 ID</label>' +
          '<input type="text" data-field="id" value="' + escapeHtml(classInfo.id) + '" placeholder="예: class-1">' +
        '</div>' +
        '<div class="field">' +
          '<label>반 이름</label>' +
          '<input type="text" data-field="name" value="' + escapeHtml(classInfo.name) + '" placeholder="예: 1반">' +
        '</div>' +
        '<button class="btn btn-danger" type="button" data-action="remove-class">삭제</button>' +
      '</div>'
  }).join('')

  classList.querySelectorAll('[data-field]').forEach(function(input){
    input.addEventListener('change', onClassFieldChange)
  })
  classList.querySelectorAll('[data-action="remove-class"]').forEach(function(button){
    button.addEventListener('click', onRemoveClass)
  })
}

function renderCheckSetCards(){
  if(!checkMasterState.checkSets.length){
    setList.innerHTML = '<div class="empty">아직 CHECK 세트가 없습니다.<br>위에서 CHECK 세트 JSON을 하나 이상 추가해 주세요.</div>'
    return
  }

  setList.innerHTML = checkMasterState.checkSets.map(function(setInfo, index){
    const objectiveCount = setInfo.questions.filter(function(question){ return question.type === '객관식' }).length
    const subjectiveCount = setInfo.questions.filter(function(question){ return question.type === '주관식' }).length

    return '' +
      '<article class="set-card" data-set-index="' + index + '">' +
        '<div class="set-head">' +
          '<div class="set-titlebox">' +
            '<strong>' + escapeHtml(setInfo.title || ('CHECK 세트 ' + (index + 1))) + '</strong>' +
            '<span>ID: ' + escapeHtml(setInfo.id) + ' · 객관식 ' + objectiveCount + ' / 주관식 ' + subjectiveCount + '</span>' +
          '</div>' +
          '<div class="row">' +
            '<span class="pill">문항 ' + setInfo.questions.length + '개</span>' +
            '<button class="btn btn-danger" type="button" data-action="remove-set">세트 삭제</button>' +
          '</div>' +
        '</div>' +
        '<div class="set-grid">' +
          '<div class="field">' +
            '<label>세트 제목</label>' +
            '<input type="text" data-field="title" value="' + escapeHtml(setInfo.title) + '">' +
          '</div>' +
          '<div class="field">' +
            '<label>세트 ID</label>' +
            '<input type="text" data-field="id" value="' + escapeHtml(setInfo.id) + '">' +
          '</div>' +
          '<div class="field">' +
            '<label>공개 시작일</label>' +
            '<input type="date" data-field="availableFrom" value="' + escapeHtml(normalizeDateValue(setInfo.availableFrom)) + '">' +
          '</div>' +
          '<div class="field">' +
            '<label>공개 종료일</label>' +
            '<input type="date" data-field="availableTo" value="' + escapeHtml(normalizeDateValue(setInfo.availableTo)) + '">' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px">' +
          '<label>세트 설명</label>' +
          '<textarea data-field="description">' + escapeHtml(setInfo.description) + '</textarea>' +
        '</div>' +
        '<div class="field" style="margin-top:12px">' +
          '<label>배정 반</label>' +
          '<div class="class-checks">' + renderSetClassChecks(setInfo) + '</div>' +
        '</div>' +
      '</article>'
  }).join('')

  setList.querySelectorAll('[data-field]').forEach(function(input){
    input.addEventListener('input', onSetFieldInput)
    input.addEventListener('change', onSetFieldInput)
  })
  setList.querySelectorAll('[data-action="remove-set"]').forEach(function(button){
    button.addEventListener('click', onRemoveSet)
  })
  setList.querySelectorAll('[data-class-id]').forEach(function(input){
    input.addEventListener('change', onSetClassToggle)
  })
}

function renderSetClassChecks(setInfo){
  if(!checkMasterState.classes.length){
    return '<span class="empty" style="width:100%">먼저 왼쪽에서 반을 추가해 주세요.</span>'
  }

  return checkMasterState.classes.map(function(classInfo){
    const isChecked = setInfo.classIds.includes(classInfo.id)
    return '' +
      '<label class="class-check">' +
        '<input type="checkbox" data-class-id="' + escapeHtml(classInfo.id) + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(classInfo.name) + '</span>' +
      '</label>'
  }).join('')
}

function updateCheckMasterSummary(){
  classCount.textContent = String(checkMasterState.classes.length)
  setCount.textContent = String(checkMasterState.checkSets.length)
  questionCount.textContent = String(checkMasterState.checkSets.reduce(function(sum, setInfo){
    return sum + setInfo.questions.length
  }, 0))
}

function onClassFieldChange(event){
  const row = event.target.closest('[data-class-index]')
  if(!row) return

  const index = Number(row.dataset.classIndex)
  const fieldName = event.target.dataset.field
  const previousId = checkMasterState.classes[index].id

  if(fieldName === 'id'){
    checkMasterState.classes[index].id = buildCheckMasterSlug(event.target.value, true) || ('class-' + (index + 1))
  }else{
    checkMasterState.classes[index].name = event.target.value
  }

  if(fieldName === 'id' && previousId !== checkMasterState.classes[index].id){
    checkMasterState.checkSets.forEach(function(setInfo){
      setInfo.classIds = setInfo.classIds.map(function(classId){
        return classId === previousId ? checkMasterState.classes[index].id : classId
      })
    })
  }

  syncCheckSetClassIds()
  renderCheckMaster()
}

function onRemoveClass(event){
  const row = event.target.closest('[data-class-index]')
  if(!row) return

  if(checkMasterState.classes.length === 1){
    window.alert('최소 1개 반은 있어야 합니다.')
    return
  }

  const index = Number(row.dataset.classIndex)
  const removedId = checkMasterState.classes[index].id
  checkMasterState.classes.splice(index, 1)

  checkMasterState.checkSets.forEach(function(setInfo){
    setInfo.classIds = setInfo.classIds.filter(function(classId){
      return classId !== removedId
    })
  })

  syncCheckSetClassIds()
  renderCheckMaster()
}

function onSetFieldInput(event){
  const card = event.target.closest('[data-set-index]')
  if(!card) return

  const index = Number(card.dataset.setIndex)
  const fieldName = event.target.dataset.field
  const setInfo = checkMasterState.checkSets[index]
  if(!setInfo) return

  if(fieldName === 'id'){
    setInfo.id = buildCheckMasterSlug(event.target.value, true) || ('check-set-' + (index + 1))
  }else{
    setInfo[fieldName] = event.target.value
  }
}

function onSetClassToggle(event){
  const card = event.target.closest('[data-set-index]')
  if(!card) return

  const index = Number(card.dataset.setIndex)
  const setInfo = checkMasterState.checkSets[index]
  if(!setInfo) return

  const classId = event.target.dataset.classId
  if(event.target.checked){
    if(!setInfo.classIds.includes(classId)) setInfo.classIds.push(classId)
  }else{
    setInfo.classIds = setInfo.classIds.filter(function(entry){
      return entry !== classId
    })
  }
}

function onRemoveSet(event){
  const card = event.target.closest('[data-set-index]')
  if(!card) return

  const index = Number(card.dataset.setIndex)
  checkMasterState.checkSets.splice(index, 1)
  renderCheckMaster()
}

function loadExistingCheckMaster(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  readJsonFile(file, function(data){
    checkMasterState = normalizeCheckMasterData(data)
    updateCheckMasterStatus(file.name + ' 파일에서 기존 CHECK 마스터를 복원했습니다.')
    renderCheckMaster()
  }, '읽을 수 없는 check_data.json입니다.')

  event.target.value = ''
}

function addCheckSetFiles(event){
  const files = Array.from(event.target.files || [])
  if(!files.length) return

  let importedCount = 0
  const defaultClassIds = checkMasterState.classes.map(function(classInfo){
    return classInfo.id
  })

  files.forEach(function(file){
    readJsonFile(file, function(data){
      const importedSets = extractImportedCheckSets(data, defaultClassIds)
      importedSets.forEach(function(setInfo){
        checkMasterState.checkSets.push(setInfo)
      })
      importedCount += importedSets.length
      renderCheckMaster()
      if(importedCount){
        updateCheckMasterStatus('CHECK 세트 ' + importedCount + '개를 추가했습니다.')
      }
    }, '"' + file.name + '" 파일은 CHECK 세트 JSON 또는 check_data.json 형식이 아닙니다.')
  })

  event.target.value = ''
}

function extractImportedCheckSets(data, defaultClassIds){
  if(Array.isArray(data && data.checkSets)){
    return data.checkSets.map(function(entry){
      return createCheckMasterSet(entry, defaultClassIds)
    })
  }
  if(Array.isArray(data && data.questions)){
    return [createCheckMasterSet(data, defaultClassIds)]
  }
  throw new Error('INVALID_CHECK_IMPORT')
}

function normalizeCheckMasterData(data){
  if(!data || !Array.isArray(data.checkSets)) throw new Error('INVALID_CHECK_MASTER')

  const classes = Array.isArray(data.classes) && data.classes.length
    ? data.classes.map(function(classInfo, index){
        return createCheckClass(index, classInfo)
      })
    : collectClassesFromCheckSets(data.checkSets)

  const finalClasses = classes.length ? classes : [createCheckClass(0)]
  const defaultClassIds = finalClasses.map(function(classInfo){
    return classInfo.id
  })

  return {
    classes: finalClasses,
    checkSets: data.checkSets.map(function(entry){
      return createCheckMasterSet(entry, defaultClassIds)
    })
  }
}

function collectClassesFromCheckSets(checkSets){
  const ids = []
  ;(Array.isArray(checkSets) ? checkSets : []).forEach(function(entry){
    ;(Array.isArray(entry && entry.classIds) ? entry.classIds : []).forEach(function(classId){
      const normalized = String(classId || '').trim()
      if(normalized && !ids.includes(normalized)) ids.push(normalized)
    })
  })

  return ids.map(function(classId, index){
    return createCheckClass(index, { id: classId, name: classId })
  })
}

function syncCheckSetClassIds(){
  const validIds = checkMasterState.classes.map(function(classInfo){
    return classInfo.id
  }).filter(Boolean)

  checkMasterState.checkSets.forEach(function(setInfo){
    setInfo.classIds = (Array.isArray(setInfo.classIds) ? setInfo.classIds : []).filter(function(classId){
      return validIds.includes(classId)
    })
    if(!setInfo.classIds.length && validIds.length){
      setInfo.classIds = validIds.slice()
    }
  })
}

function ensureUniqueCheckSetId(baseId){
  const rawBase = buildCheckMasterSlug(baseId, true) || 'check-set'
  let candidate = rawBase
  let index = 2
  const usedIds = new Set(checkMasterState.checkSets.map(function(setInfo){
    return setInfo.id
  }))
  while(usedIds.has(candidate)){
    candidate = rawBase + '-' + index
    index += 1
  }
  return candidate
}

function generateCheckMaster(){
  const classErrors = validateCheckClasses()
  if(classErrors.length){
    window.alert(classErrors[0])
    return
  }
  if(!checkMasterState.checkSets.length){
    window.alert('최소 1개 이상의 CHECK 세트를 추가해 주세요.')
    return
  }

  const invalidSetIndex = checkMasterState.checkSets.findIndex(function(setInfo){
    return !setInfo.title.trim() || !setInfo.id.trim() || !setInfo.questions.length || !setInfo.classIds.length
  })
  if(invalidSetIndex >= 0){
    window.alert('세트 ' + (invalidSetIndex + 1) + '의 제목, ID, 배정 반, 문항 구성을 확인해 주세요.')
    return
  }

  const invalidQuestionInfo = findInvalidCheckQuestion()
  if(invalidQuestionInfo){
    window.alert('세트 ' + invalidQuestionInfo.setNumber + '의 문항 ' + invalidQuestionInfo.questionNumber + ' 정답을 확인해 주세요.')
    return
  }

  const duplicateSetError = validateCheckSetIds()
  if(duplicateSetError){
    window.alert(duplicateSetError)
    return
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    classes: checkMasterState.classes.map(function(classInfo){
      return {
        id: classInfo.id.trim(),
        name: classInfo.name.trim()
      }
    }),
    checkSets: checkMasterState.checkSets.map(function(setInfo){
      return {
        id: buildCheckMasterSlug(setInfo.id, true) || 'check-set',
        title: setInfo.title.trim(),
        description: setInfo.description.trim(),
        classIds: setInfo.classIds.slice(),
        availableFrom: normalizeDateValue(setInfo.availableFrom),
        availableTo: normalizeDateValue(setInfo.availableTo),
        questions: setInfo.questions.map(function(question, index){
          const type = normalizeCheckQuestionType(question.type)
          const number = normalizeCheckQuestionNumber(question.number, index + 1)
          return {
            id: String(question.id || ('q' + number)).trim() || ('q' + number),
            number: number,
            type: type,
            problemType: normalizeCheckProblemType(question.problemType),
            prompt: String(question.prompt || ('문항 ' + number)).trim() || ('문항 ' + number),
            answer: normalizeCheckAnswerByType(type, question.answer),
            acceptableAnswers: normalizeCheckAcceptableAnswers(type, question.acceptableAnswers),
            explanation: String(question.explanation || '').trim()
          }
        })
      }
    })
  }

  downloadJsonFile('check_data.json', payload)
  updateCheckMasterStatus('check_data.json을 다운로드했습니다. 웹에서는 이 파일만 교체하면 됩니다.')
}

function validateCheckClasses(){
  const errors = []
  const seen = new Set()

  checkMasterState.classes.forEach(function(classInfo, index){
    if(!classInfo.id.trim()){
      errors.push((index + 1) + '번째 반의 ID를 입력해 주세요.')
      return
    }
    if(seen.has(classInfo.id.trim())){
      errors.push('반 ID "' + classInfo.id.trim() + '"가 중복되었습니다.')
      return
    }
    seen.add(classInfo.id.trim())
  })

  return errors
}

function validateCheckSetIds(){
  const seen = new Set()
  for(let index = 0; index < checkMasterState.checkSets.length; index += 1){
    const setInfo = checkMasterState.checkSets[index]
    const setId = buildCheckMasterSlug(setInfo.id, true) || ''
    if(!setId) return (index + 1) + '번째 CHECK 세트의 ID를 입력해 주세요.'
    if(seen.has(setId)) return 'CHECK 세트 ID "' + setId + '"가 중복되었습니다.'
    seen.add(setId)
  }
  return ''
}

function findInvalidCheckQuestion(){
  for(let setIndex = 0; setIndex < checkMasterState.checkSets.length; setIndex += 1){
    const setInfo = checkMasterState.checkSets[setIndex]
    for(let questionIndex = 0; questionIndex < setInfo.questions.length; questionIndex += 1){
      const question = setInfo.questions[questionIndex]
      const type = normalizeCheckQuestionType(question.type)
      if(type === '주관식') continue
      const answer = normalizeCheckAnswerByType(type, question.answer)
      if(!answer){
        return {
          setNumber: setIndex + 1,
          questionNumber: normalizeCheckQuestionNumber(question.number, questionIndex + 1)
        }
      }
    }
  }
  return null
}

function updateCheckMasterStatus(message){
  masterStatus.innerHTML = '<strong>상태:</strong> ' + escapeHtml(message)
}

function readJsonFile(file, onSuccess, errorMessage){
  const reader = new FileReader()
  reader.onload = function(loadEvent){
    try{
      const data = JSON.parse(loadEvent.target.result)
      onSuccess(data)
    }catch(error){
      window.alert(errorMessage)
    }
  }
  reader.readAsText(file)
}

function normalizeDateValue(value){
  const text = String(value || '').trim()
  if(!text) return ''
  return text.slice(0, 10)
}

function normalizeCheckQuestionType(value){
  return String(value || '').trim() === '주관식' ? '주관식' : '객관식'
}

function normalizeCheckProblemType(value){
  const normalized = String(value || '').trim()
  return normalized || '기타'
}

function normalizeChoiceAnswer(value){
  const match = String(value || '').trim().match(/[1-5]/)
  return match ? match[0] : ''
}

function normalizeCheckAnswerByType(type, value){
  return type === '객관식'
    ? normalizeChoiceAnswer(value)
    : String(value || '').trim()
}

function normalizeCheckAcceptableAnswers(type, value){
  if(type === '객관식') return []

  const rows = Array.isArray(value)
    ? value
    : String(value || '').split(/\r?\n/)

  return rows.map(function(entry){
    return String(entry || '').trim()
  }).filter(Boolean)
}

function normalizeCheckQuestionNumber(value, fallback){
  const number = Number(value)
  if(!Number.isFinite(number) || number < 1) return Math.max(1, Number(fallback) || 1)
  return Math.floor(number)
}

function buildCheckMasterSlug(value, preserveManual){
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
