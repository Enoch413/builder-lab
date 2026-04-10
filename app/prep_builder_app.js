const DEFAULT_CLASS_CONFIGS = [
  { id: 'class-1-gangseo-b', name: '1강서B', password: '' },
  { id: 'class-2-gangseo-a', name: '2강서A', password: '' },
  { id: 'class-1-seonbu', name: '1선부', password: '' },
  { id: 'class-3-seonbu', name: '3선부', password: '' }
]

let bundleState = createEmptyBundle()
let rotationImportClassIds = []
rotationImportClassIds = bundleState.classes.map(function(classInfo){ return classInfo.id })

document.getElementById('load-master-btn').addEventListener('click', function(){
  document.getElementById('master-input').click()
})
document.getElementById('add-rotation-btn').addEventListener('click', function(){
  document.getElementById('rotation-input').click()
})
document.getElementById('master-input').addEventListener('change', onMasterLoad)
document.getElementById('rotation-input').addEventListener('change', onRotationLoad)
document.getElementById('add-class-btn').addEventListener('click', addClassConfig)
document.getElementById('generate-btn').addEventListener('click', generateBundle)
const globalPasswordInput = document.getElementById('global-password')
if(globalPasswordInput){
  globalPasswordInput.addEventListener('input', function(event){
    bundleState.prepConfig.globalPassword = event.target.value
  })
}

renderAll()

function createEmptyBundle(){
  return {
    prepConfig: {
      pageTitle: 'ROTATION PREP',
      globalPassword: ''
    },
    classes: DEFAULT_CLASS_CONFIGS.map(function(classInfo, index){
      return createClassConfig(index, classInfo)
    }),
    studySets: []
  }
}

function hasOwnPropertyV2(source, key){
  return !!source && Object.prototype.hasOwnProperty.call(source, key)
}

function normalizeOptionalPassword(value){
  return String(value || '').trim()
}

function createClassConfig(index, source){
  const info = source || {}
  const fallback = DEFAULT_CLASS_CONFIGS[index] || {}
  const id = String(info.id || fallback.id || ('class-' + (index + 1))).trim() || ('class-' + (index + 1))
  const name = String(info.name || ((index + 1) + '반')).trim() || ((index + 1) + '반')
  const password = hasOwnPropertyV2(info, 'password')
    ? normalizeOptionalPassword(info.password)
    : normalizeOptionalPassword(fallback.password)
  return {
    id: id,
    name: name,
    password: password
  }
}

function onFileLoad(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  const reader = new FileReader()
  reader.onload = function(loadEvent){
    try{
      const data = JSON.parse(loadEvent.target.result)
      if(Array.isArray(data.studySets)){
        if(bundleState.studySets.length && !window.confirm('현재 편집 중인 내용을 덮어쓰고 기존 master session.json을 불러올까요?')){
          event.target.value = ''
          return
        }
        bundleState = normalizeBundleForBuilder(data)
        updateFileStatus(file.name, '기존 master session.json을 불러와 전체 설정을 복원했습니다.')
      }else if(Array.isArray(data.passages)){
        bundleState.studySets.push(createStudySetFromRotation(data, file.name))
        syncAssignments()
        updateFileStatus(file.name, 'ROTATION 세션을 새 학습 세트로 추가했습니다.')
      }else{
        throw new Error('INVALID_JSON')
      }

      renderAll()
    }catch(error){
      window.alert('읽을 수 있는 ROTATION 세션 JSON 또는 master session.json이 아닙니다.')
    }
  }

  reader.readAsText(file)
  event.target.value = ''
}

function createStudySetFromRotation(data, fileName){
  const passages = Array.isArray(data.passages) ? deepClone(data.passages) : []
  return {
    id: 'set-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    title: deriveSetTitle(data, fileName),
    sourceName: fileName || 'rotation-session.json',
    startDate: '',
    endDate: '',
    passages: passages,
    questionCounts: deepClone(data.questionCounts || {}),
    savedAt: String(data.savedAt || '').trim(),
    classAssignments: bundleState.classes.map(function(classInfo){
      return {
        classId: classInfo.id,
        passageIndexes: passages.map(function(_, index){ return index })
      }
    })
  }
}

function onMasterLoad(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  readJsonFile(file, function(data){
    if(!Array.isArray(data.studySets)) throw new Error('INVALID_MASTER')
    if(bundleState.studySets.length && !window.confirm('현재 편집 중인 내용을 덮어쓰고 기존 master session.json을 불러올까요?')){
      return
    }
    bundleState = normalizeBundleForBuilder(data)
    rotationImportClassIds = bundleState.classes.map(function(classInfo){ return classInfo.id })
    updateFileStatus(file.name, '기존 master session.json을 불러와 전체 설정을 복원했습니다.')
    renderAll()
  }, '읽을 수 있는 master session.json이 아닙니다.')

  event.target.value = ''
}

function onRotationLoad(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return

  readJsonFile(file, function(data){
    if(!Array.isArray(data.passages)) throw new Error('INVALID_ROTATION')
    const targetClassIds = getSelectedImportClassIds()
    if(!targetClassIds.length){
      window.alert('새 ROTATION 세션을 추가할 반을 하나 이상 선택해 주세요.')
      return
    }
    bundleState.studySets.push(createStudySetFromRotation(data, file.name, targetClassIds))
    syncAssignments()
    updateFileStatus(file.name, 'ROTATION 세션을 새 학습 세트로 추가했고, 선택한 반에 기본 배정했습니다.')
    renderAll()
  }, '읽을 수 있는 ROTATION 세션 JSON이 아닙니다.')

  event.target.value = ''
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

function createStudySetFromRotation(data, fileName, defaultClassIds){
  const passages = Array.isArray(data.passages) ? deepClone(data.passages) : []
  const allowedClassIds = new Set(Array.isArray(defaultClassIds) ? defaultClassIds : [])
  return {
    id: 'set-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    title: deriveSetTitle(data, fileName),
    sourceName: fileName || 'rotation-session.json',
    startDate: '',
    endDate: '',
    passages: passages,
    questionCounts: deepClone(data.questionCounts || {}),
    savedAt: String(data.savedAt || '').trim(),
    classAssignments: bundleState.classes.map(function(classInfo){
      return {
        classId: classInfo.id,
        passageIndexes: allowedClassIds.has(classInfo.id)
          ? passages.map(function(_, index){ return index })
          : []
      }
    })
  }
}

function normalizeBundleForBuilder(data){
  const source = data || {}
  const prepConfigSource = source.prepConfig || {}
  const classesSource = Array.isArray(source.classes) && source.classes.length ? source.classes : source.prepClasses
  const classes = (Array.isArray(classesSource) ? classesSource : []).slice(0, 8).map(function(classInfo, index){
    return createClassConfig(index, classInfo)
  })
  const finalClasses = classes.length ? classes : [createClassConfig(0)]

  const studySets = (Array.isArray(source.studySets) ? source.studySets : []).map(function(studySet, index){
    return {
      id: String(studySet && studySet.id || ('set-' + (index + 1))).trim() || ('set-' + (index + 1)),
      title: String(studySet && studySet.title || ('학습 세트 ' + (index + 1))).trim() || ('학습 세트 ' + (index + 1)),
      sourceName: String(studySet && studySet.sourceName || '').trim(),
      startDate: normalizeDateValue(studySet && studySet.startDate),
      endDate: normalizeDateValue(studySet && studySet.endDate),
      passages: deepClone(Array.isArray(studySet && studySet.passages) ? studySet.passages : []),
      questionCounts: deepClone(studySet && studySet.questionCounts || {}),
      savedAt: String(studySet && studySet.savedAt || '').trim(),
      classAssignments: buildAssignmentsFromSource(studySet, finalClasses)
    }
  })

  return {
    prepConfig: {
      pageTitle: String(prepConfigSource.pageTitle || source.pageTitle || 'ROTATION PREP').trim() || 'ROTATION PREP',
      globalPassword: hasOwnPropertyV2(prepConfigSource, 'globalPassword')
        ? normalizeOptionalPassword(prepConfigSource.globalPassword)
        : normalizeOptionalPassword(source.password)
    },
    classes: finalClasses,
    studySets: studySets
  }
}

function buildAssignmentsFromSource(studySet, classes){
  const passageCount = Array.isArray(studySet && studySet.passages) ? studySet.passages.length : 0
  const allIndexes = Array.from({ length: passageCount }, function(_, index){ return index })
  const assignments = Array.isArray(studySet && studySet.classAssignments) ? studySet.classAssignments : []

  const normalized = assignments.map(function(assignment){
    return {
      classId: String(assignment && assignment.classId || '').trim(),
      passageIndexes: normalizeNumberList(assignment && assignment.passageIndexes, passageCount)
    }
  }).filter(function(assignment){
    return assignment.classId
  })

  if(!normalized.length){
    return classes.map(function(classInfo){
      return {
        classId: classInfo.id,
        passageIndexes: allIndexes.slice()
      }
    })
  }

  const assignmentMap = new Map(normalized.map(function(assignment){
    return [assignment.classId, assignment]
  }))

  return classes.map(function(classInfo){
    const existing = assignmentMap.get(classInfo.id)
    return {
      classId: classInfo.id,
      passageIndexes: existing ? existing.passageIndexes : []
    }
  })
}

function syncAssignments(){
  bundleState.studySets.forEach(function(studySet){
    const assignmentMap = new Map((studySet.classAssignments || []).map(function(assignment){
      return [assignment.classId, assignment]
    }))

    studySet.classAssignments = bundleState.classes.map(function(classInfo){
      const existing = assignmentMap.get(classInfo.id)
      return existing ? existing : {
        classId: classInfo.id,
        passageIndexes: []
      }
    })
  })
}

function syncRotationImportClassIds(preferredIds){
  const validIds = new Set(bundleState.classes.map(function(classInfo){ return classInfo.id }))
  const source = Array.isArray(preferredIds) ? preferredIds : rotationImportClassIds
  rotationImportClassIds = source.filter(function(classId){
    return validIds.has(classId)
  })
  return rotationImportClassIds
}

function getSelectedImportClassIds(){
  syncRotationImportClassIds(rotationImportClassIds)
  return rotationImportClassIds.slice()
}

function normalizeClassIdValue(value, index){
  return String(value || '').trim() || ('class-' + (index + 1))
}

function ensureUniqueClassId(value, index){
  const existingIds = new Set(bundleState.classes.map(function(classInfo, classIndex){
    if(classIndex === index) return ''
    return String(classInfo && classInfo.id || '').trim()
  }).filter(Boolean))

  if(!existingIds.has(value)) return value

  let suffix = 2
  let nextValue = value + '-' + suffix
  while(existingIds.has(nextValue)){
    suffix += 1
    nextValue = value + '-' + suffix
  }
  return nextValue
}

function toggleImportClass(classId, checked){
  const selected = new Set(getSelectedImportClassIds())
  if(checked) selected.add(classId)
  else selected.delete(classId)
  rotationImportClassIds = Array.from(selected)
  renderImportClassTargets()
}

function selectAllImportClasses(){
  rotationImportClassIds = bundleState.classes.map(function(classInfo){ return classInfo.id })
  renderImportClassTargets()
}

function clearImportClasses(){
  rotationImportClassIds = []
  renderImportClassTargets()
}

function renderImportClassTargets(){
  const targetIds = syncRotationImportClassIds(rotationImportClassIds)
  const container = document.getElementById('import-class-targets')
  if(!bundleState.classes.length){
    container.innerHTML = '<div class="target-empty">반을 먼저 추가해 주세요.</div>'
    return
  }

  container.innerHTML = bundleState.classes.map(function(classInfo){
    const checked = targetIds.indexOf(classInfo.id) >= 0
    return '' +
      '<label class="target-chip">' +
        '<input type="checkbox" ' + (checked ? 'checked ' : '') + 'onchange="toggleImportClass(\'' + escapeAttr(classInfo.id) + '\', this.checked)">' +
        '<span>' + escapeHtml(classInfo.name) + '</span>' +
      '</label>'
  }).join('')
}

function addClassConfig(){
  if(bundleState.classes.length >= 8) return
  bundleState.classes.push(createClassConfig(bundleState.classes.length))
  rotationImportClassIds = bundleState.classes.map(function(classInfo){ return classInfo.id })
  syncAssignments()
  renderAll()
}

function removeClassConfig(index){
  if(bundleState.classes.length <= 1) return
  bundleState.classes.splice(index, 1)
  syncRotationImportClassIds(rotationImportClassIds)
  syncAssignments()
  renderAll()
}

function updateClassField(index, field, value){
  if(!bundleState.classes[index]) return
  bundleState.classes[index][field] = value
  renderImportClassTargets()
  renderSummary()
  renderSetEditor()
}

function updateClassId(index, value){
  const classInfo = bundleState.classes[index]
  if(!classInfo) return

  const previousId = String(classInfo.id || '').trim()
  const nextId = ensureUniqueClassId(normalizeClassIdValue(value, index), index)
  classInfo.id = nextId

  if(previousId && previousId !== nextId){
    rotationImportClassIds = rotationImportClassIds.map(function(classId){
      return classId === previousId ? nextId : classId
    })

    bundleState.studySets.forEach(function(studySet){
      studySet.classAssignments = (studySet.classAssignments || []).map(function(assignment){
        if(!assignment || assignment.classId !== previousId) return assignment
        return {
          classId: nextId,
          passageIndexes: normalizeNumberList(assignment.passageIndexes, Array.isArray(studySet.passages) ? studySet.passages.length : 0)
        }
      })
    })
  }

  syncRotationImportClassIds(rotationImportClassIds)
  syncAssignments()
  renderAll()
}

function removeStudySet(index){
  bundleState.studySets.splice(index, 1)
  renderAll()
}

function updateStudySetField(index, field, value){
  if(!bundleState.studySets[index]) return
  bundleState.studySets[index][field] = value
  renderSummary()
  renderSetEditor()
}

function toggleAssignment(setIndex, classId, passageIndex, checked){
  const studySet = bundleState.studySets[setIndex]
  if(!studySet) return

  const assignment = studySet.classAssignments.find(function(item){
    return item.classId === classId
  })
  if(!assignment) return

  const valueSet = new Set(assignment.passageIndexes)
  if(checked) valueSet.add(passageIndex)
  else valueSet.delete(passageIndex)

  assignment.passageIndexes = Array.from(valueSet).sort(function(a, b){ return a - b })
  renderSummary()
  renderSetEditor()
}

function renderAll(){
  syncRotationImportClassIds(rotationImportClassIds)
  if(globalPasswordInput){
    globalPasswordInput.value = bundleState.prepConfig.globalPassword
  }
  renderImportClassTargets()
  renderSummary()
  renderClassEditor()
  renderSetEditor()
  document.getElementById('generate-btn').disabled = !bundleState.studySets.length
}

function renderSummary(){
  const passageCount = bundleState.studySets.reduce(function(sum, studySet){
    return sum + studySet.passages.length
  }, 0)

  const cardCount = bundleState.studySets.reduce(function(sum, studySet){
    return sum + studySet.passages.reduce(function(inner, passage){
      return inner + countCards(passage)
    }, 0)
  }, 0)

  document.getElementById('summary-grid').innerHTML = [
    summaryCard('반', bundleState.classes.length + '개'),
    summaryCard('학습 세트', bundleState.studySets.length + '개'),
    summaryCard('지문', passageCount + '개'),
    summaryCard('학습 카드', cardCount + '개')
  ].join('')
}

function renderClassEditor(){
  document.getElementById('add-class-btn').disabled = bundleState.classes.length >= 8

  document.getElementById('class-editor').innerHTML = bundleState.classes.map(function(classInfo, index){
    return '' +
      '<div class="editor-card">' +
        '<div class="editor-head">' +
          '<div class="editor-index">Class ' + (index + 1) + '</div>' +
          '<button class="btn btn-ghost btn-sm" type="button" onclick="removeClassConfig(' + index + ')"' + (bundleState.classes.length === 1 ? ' disabled' : '') + '>삭제</button>' +
        '</div>' +
        '<div class="class-field-stack">' +
          '<div>' +
            '<div class="field-label">반 ID</div>' +
            '<input type="text" value="' + escapeAttr(classInfo.id) + '" onchange="updateClassId(' + index + ', this.value)">' +
          '</div>' +
          '<div>' +
            '<div class="field-label">반 이름</div>' +
            '<input type="text" value="' + escapeAttr(classInfo.name) + '" oninput="updateClassField(' + index + ', \'name\', this.value)">' +
          '</div>' +
        '</div>' +
      '</div>'
  }).join('')
}

function renderSetEditor(){
  const hasStudySets = bundleState.studySets.length > 0
  const emptyStage = document.getElementById('set-empty') || document.querySelector('#right .workspace-stage')
  const workspace = document.getElementById('set-workspace')

  if(emptyStage) emptyStage.style.display = hasStudySets ? 'none' : 'flex'
  if(workspace) workspace.style.display = hasStudySets ? 'block' : 'none'

  if(!hasStudySets){
    document.getElementById('set-editor').innerHTML = ''
    return
  }

  document.getElementById('set-editor').innerHTML = bundleState.studySets.map(function(studySet, setIndex){
    return '' +
      '<div class="editor-card">' +
        '<div class="editor-head">' +
          '<div>' +
            '<div class="editor-index">Set ' + (setIndex + 1) + '</div>' +
            '<div class="editor-meta">' + studySet.passages.length + '개 지문 · ' + escapeHtml(studySet.sourceName || '불러온 ROTATION 세션') + '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" type="button" onclick="removeStudySet(' + setIndex + ')">삭제</button>' +
        '</div>' +
        '<div class="row-2">' +
          '<div>' +
            '<div class="field-label">세트 제목</div>' +
            '<input type="text" value="' + escapeAttr(studySet.title) + '" oninput="updateStudySetField(' + setIndex + ', \'title\', this.value)">' +
          '</div>' +
          '<div>' +
            '<div class="field-label">공개 시작일</div>' +
            '<input type="date" value="' + escapeAttr(studySet.startDate) + '" oninput="updateStudySetField(' + setIndex + ', \'startDate\', this.value)">' +
          '</div>' +
        '</div>' +
        '<div class="row-2" style="margin-top:12px">' +
          '<div>' +
            '<div class="field-label">공개 종료일</div>' +
            '<input type="date" value="' + escapeAttr(studySet.endDate) + '" oninput="updateStudySetField(' + setIndex + ', \'endDate\', this.value)">' +
          '</div>' +
          '<div>' +
            '<div class="field-label">안내</div>' +
            '<div class="hint">둘 다 비워 두면 항상 열립니다. 시작일만 있으면 그날부터 열리고, 종료일만 있으면 그날까지 열립니다.</div>' +
          '</div>' +
        '</div>' +
        '<div class="assign-list" style="margin-top:14px">' +
          bundleState.classes.map(function(classInfo){
            return renderAssignmentCard(studySet, setIndex, classInfo)
          }).join('') +
        '</div>' +
      '</div>'
  }).join('')
}

function renderAssignmentCard(studySet, setIndex, classInfo){
  const assignment = studySet.classAssignments.find(function(item){
    return item.classId === classInfo.id
  }) || { passageIndexes: [] }

  return '' +
    '<div class="assign-card">' +
      '<div class="assign-head">' +
        '<div>' +
          '<div class="assign-name">' + escapeHtml(classInfo.name) + '</div>' +
          '<div class="assign-meta">' + assignment.passageIndexes.length + '개 지문 선택</div>' +
        '</div>' +
      '</div>' +
      '<div class="passage-grid">' +
        studySet.passages.map(function(passage, passageIndex){
          const checked = assignment.passageIndexes.indexOf(passageIndex) >= 0
          return '' +
            '<label class="passage-option">' +
              '<input type="checkbox" ' + (checked ? 'checked ' : '') + 'onchange="toggleAssignment(' + setIndex + ', \'' + escapeAttr(classInfo.id) + '\', ' + passageIndex + ', this.checked)">' +
              '<div>' +
                '<div class="passage-title">' + escapeHtml(getPassageTitle(passage, passageIndex)) + '</div>' +
                '<div class="passage-preview">' + escapeHtml(getPassagePreview(passage)) + '</div>' +
              '</div>' +
            '</label>'
        }).join('') +
      '</div>' +
    '</div>'
}

function generateBundle(){
  if(!bundleState.studySets.length) return

  const classes = bundleState.classes.map(function(classInfo, index){
    return {
      id: String(classInfo.id || ('class-' + (index + 1))).trim() || ('class-' + (index + 1)),
      name: String(classInfo.name || ((index + 1) + '반')).trim() || ((index + 1) + '반'),
      password: normalizeOptionalPassword(classInfo.password)
    }
  })

  const invalidSet = bundleState.studySets.find(function(studySet){
    const hasAssignment = studySet.classAssignments.some(function(assignment){
      return normalizeNumberList(assignment.passageIndexes, studySet.passages.length).length > 0
    })

    return !studySet.passages.length
      || !hasAssignment
      || (studySet.startDate && studySet.endDate && studySet.startDate > studySet.endDate)
  })

  if(invalidSet){
    window.alert('지문이 없거나, 어느 반에도 배정되지 않았거나, 시작일과 종료일 순서가 잘못된 학습 세트가 있습니다.')
    return
  }

  const now = new Date().toISOString()
  const output = {
    version: 2,
    bundleVersion: 2,
    savedAt: now,
    prepConfig: {
      pageTitle: String(bundleState.prepConfig.pageTitle || 'ROTATION PREP').trim() || 'ROTATION PREP',
      globalPassword: normalizeOptionalPassword(bundleState.prepConfig.globalPassword),
      generatedAt: now
    },
    classes: classes,
    studySets: bundleState.studySets.map(function(studySet, setIndex){
      return {
        id: String(studySet.id || ('set-' + (setIndex + 1))).trim() || ('set-' + (setIndex + 1)),
        title: String(studySet.title || ('학습 세트 ' + (setIndex + 1))).trim() || ('학습 세트 ' + (setIndex + 1)),
        sourceName: String(studySet.sourceName || '').trim(),
        startDate: normalizeDateValue(studySet.startDate),
        endDate: normalizeDateValue(studySet.endDate),
        savedAt: studySet.savedAt || '',
        questionCounts: deepClone(studySet.questionCounts || {}),
        passages: deepClone(studySet.passages || []),
        classAssignments: studySet.classAssignments.map(function(assignment){
          return {
            classId: assignment.classId,
            passageIndexes: normalizeNumberList(assignment.passageIndexes, studySet.passages.length)
          }
        }).filter(function(assignment){
          return assignment.passageIndexes.length > 0
        })
      }
    })
  }

  downloadJson('session.json', output)
  document.getElementById('result').classList.add('show')
  document.getElementById('result-sub').textContent = 'master session.json을 만들었습니다. 이제 웹 서버의 기존 session.json만 이 파일로 교체하면 됩니다.'
}

function summaryCard(label, value){
  return '<div class="summary-card"><div class="summary-label">' + escapeHtml(label) + '</div><div class="summary-value">' + escapeHtml(value) + '</div></div>'
}

function countCards(passage){
  const selectedLines = Array.isArray(passage && passage.selectedLines)
    ? passage.selectedLines.length
    : (Array.isArray(passage && passage.selectedSents) ? passage.selectedSents.length : 0)

  const grammar = Array.isArray(passage && passage.grammarSelections)
    ? passage.grammarSelections.length
    : (Array.isArray(passage && passage.grammarRows) ? passage.grammarRows.length : 0)

  const vocab = Array.isArray(passage && passage.vocabRows) ? passage.vocabRows.length : 0
  const answers = passage && passage.questionAnswers && typeof passage.questionAnswers === 'object' ? passage.questionAnswers : {}
  const qa = ['topic'].filter(function(key){
    return String(answers[key] || '').trim()
  }).length

  return selectedLines + grammar + vocab + qa
}

function deriveSetTitle(data, fileName){
  const prepTitle = String(data && data.prepConfig && data.prepConfig.pageTitle || '').trim()
  if(prepTitle) return prepTitle

  const passageTitle = Array.isArray(data && data.passages) && data.passages[0]
    ? String(data.passages[0].title || data.passages[0].name || '').trim()
    : ''
  if(passageTitle) return passageTitle

  const cleanName = String(fileName || '학습 세트').replace(/\.json$/i, '').trim()
  return cleanName || '학습 세트'
}

function getPassageTitle(passage, index){
  return String(passage && (passage.title || passage.name) || '').trim() || ('지문 ' + (index + 1))
}

function getPassagePreview(passage){
  const text = String(passage && passage.text || '').replace(/\r/g, '')
  const firstLine = text.split('\n').map(function(line){ return line.trim() }).filter(Boolean)[0] || ''
  return firstLine || '본문 미리보기가 없습니다.'
}

function normalizeDateValue(value){
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function normalizeNumberList(list, max){
  const result = []
  const seen = new Set()
  ;(Array.isArray(list) ? list : []).forEach(function(value){
    const number = Number(value)
    if(Number.isInteger(number) && number >= 0 && number < max && !seen.has(number)){
      seen.add(number)
      result.push(number)
    }
  })
  return result.sort(function(a, b){ return a - b })
}

function updateFileStatus(title, sub){
  document.getElementById('file-zone').classList.add('loaded')
  document.getElementById('fz-title').textContent = title
  document.getElementById('fz-sub').textContent = sub
}

function deepClone(value){
  return JSON.parse(JSON.stringify(value))
}

function downloadJson(fileName, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeHtml(text){
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(text){
  return escapeHtml(text)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
