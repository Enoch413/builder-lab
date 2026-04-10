const DEFAULT_CLASS_CONFIGS = [
  { id: 'class-1-gangseo-b', name: '1강서B', password: '' },
  { id: 'class-2-gangseo-a', name: '2강서A', password: '' },
  { id: 'class-1-seonbu', name: '1선부', password: '' },
  { id: 'class-3-seonbu', name: '3선부', password: '' }
]
const PREP_MASTER_LAB_NAME = 'prep-master-builder'

let bundleState = createEmptyBundle()
let rotationImportClassIds = []
let studySetUiState = {}
let prepAdminProfile = null
let prepDefaultClassId = ''
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
initializePrepMasterAdminDefaults()

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

function matchesPrepClassList(classes, sources){
  const targetList = Array.isArray(sources) ? sources : []
  if((Array.isArray(classes) ? classes : []).length !== targetList.length) return false

  return classes.every(function(classInfo, index){
    const fallback = createClassConfig(index, targetList[index])
    return String(classInfo && classInfo.id || '').trim() === fallback.id
      && String(classInfo && classInfo.name || '').trim() === fallback.name
      && normalizeOptionalPassword(classInfo && classInfo.password) === fallback.password
  })
}

function isPrepBuilderUsingFallbackState(){
  return !bundleState.studySets.length && matchesPrepClassList(bundleState.classes, DEFAULT_CLASS_CONFIGS)
}

function getPrepProfileClassIds(){
  return prepAdminProfile && Array.isArray(prepAdminProfile.classIds)
    ? prepAdminProfile.classIds.slice()
    : []
}

function getPrepPreferredClassId(){
  const validIds = bundleState.classes.map(function(classInfo){
    return String(classInfo && classInfo.id || '').trim()
  }).filter(Boolean)

  if(prepDefaultClassId && validIds.includes(prepDefaultClassId)){
    return prepDefaultClassId
  }

  return getPrepProfileClassIds().find(function(classId){
    return validIds.includes(classId)
  }) || ''
}

function getPrepDefaultAssignedClassIds(){
  const preferredClassId = getPrepPreferredClassId()
  return preferredClassId ? [preferredClassId] : []
}

function rememberPrepLastClassId(classId){
  const normalizedClassId = String(classId || '').trim()
  if(!normalizedClassId || !prepAdminProfile || !prepAdminProfile.uid) return
  if(!getPrepProfileClassIds().includes(normalizedClassId)) return

  prepDefaultClassId = normalizedClassId
  if(window.builderLabAuth && typeof window.builderLabAuth.rememberLastClassId === 'function'){
    window.builderLabAuth.rememberLastClassId(PREP_MASTER_LAB_NAME, prepAdminProfile.uid, normalizedClassId)
  }
}

function syncPrepRememberedClassId(previousId, nextId){
  if(!prepAdminProfile || !prepAdminProfile.uid || !previousId || previousId === nextId) return
  if(!getPrepProfileClassIds().includes(previousId)) return
  if(!getPrepProfileClassIds().includes(nextId)) return
  rememberPrepLastClassId(nextId)
}

async function initializePrepMasterAdminDefaults(){
  if(!window.builderLabAuth || typeof window.builderLabAuth.resolveLabAdminDefaults !== 'function') return

  const canApplyClassDefaults = isPrepBuilderUsingFallbackState()
  const resolved = await window.builderLabAuth.resolveLabAdminDefaults({
    labName: PREP_MASTER_LAB_NAME,
    classes: bundleState.classes
  })

  prepAdminProfile = resolved && resolved.applied && resolved.profile ? resolved.profile : null
  prepDefaultClassId = resolved && resolved.applied && resolved.defaultClassId ? resolved.defaultClassId : ''

  if(!canApplyClassDefaults || !isPrepBuilderUsingFallbackState() || !resolved || !resolved.applied || !Array.isArray(resolved.classes) || !resolved.classes.length){
    return
  }

  bundleState.classes = resolved.classes.slice(0, 8).map(function(classInfo, index){
    return createClassConfig(index, classInfo)
  })
  rotationImportClassIds = getPrepDefaultAssignedClassIds()
  syncAssignments()
  renderAll()
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
    bundleState.studySets.push(createStudySetFromRotation(data, file.name, getPrepDefaultAssignedClassIds()))
    syncAssignments()
    updateFileStatus(file.name, 'ROTATION 세션을 새 학습 세트로 추가했습니다. 반 배정은 오른쪽에서 설정해 주세요.')
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
  const allPassageIndexes = passages.map(function(_, index){ return index })
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
          ? allPassageIndexes.slice()
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

function getAllPassageIndexes(studySet){
  const passageCount = Array.isArray(studySet && studySet.passages) ? studySet.passages.length : 0
  return Array.from({ length: passageCount }, function(_, index){ return index })
}

function getClassAssignment(studySet, classId){
  return (studySet.classAssignments || []).find(function(assignment){
    return assignment.classId === classId
  }) || null
}

function getAssignmentIndexes(studySet, classId){
  const assignment = getClassAssignment(studySet, classId)
  return normalizeNumberList(
    assignment && assignment.passageIndexes,
    Array.isArray(studySet && studySet.passages) ? studySet.passages.length : 0
  )
}

function isStudySetAssignedToClass(studySet, classId){
  return getAssignmentIndexes(studySet, classId).length > 0
}

function getAssignedClassCount(studySet){
  return bundleState.classes.filter(function(classInfo){
    return isStudySetAssignedToClass(studySet, classInfo.id)
  }).length
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

function preserveViewport(callback){
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  callback()
  window.scrollTo(0, scrollTop)
}

function getStudySetUiState(studySet){
  const key = String(studySet && studySet.id || '').trim()
  if(!key) return { expandedClassIds: [], initialized: true }
  if(!studySetUiState[key]){
    studySetUiState[key] = { expandedClassIds: [], initialized: false }
  }
  return studySetUiState[key]
}

function syncStudySetUiState(){
  const validSetIds = new Set(bundleState.studySets.map(function(studySet){
    return String(studySet && studySet.id || '').trim()
  }).filter(Boolean))

  Object.keys(studySetUiState).forEach(function(setId){
    if(!validSetIds.has(setId)) delete studySetUiState[setId]
  })

  const validClassIds = new Set(bundleState.classes.map(function(classInfo){
    return classInfo.id
  }))

  bundleState.studySets.forEach(function(studySet){
    const uiState = getStudySetUiState(studySet)
    const passageCount = Array.isArray(studySet && studySet.passages) ? studySet.passages.length : 0
    const explicitExpanded = Array.isArray(uiState.expandedClassIds)
      ? uiState.expandedClassIds.filter(function(classId){
          return validClassIds.has(classId)
        })
      : []

    if(uiState.initialized){
      uiState.expandedClassIds = explicitExpanded
      return
    }

    const assignedExpanded = (studySet.classAssignments || []).filter(function(assignment){
      return validClassIds.has(assignment.classId)
        && normalizeNumberList(assignment.passageIndexes, passageCount).length > 0
    }).map(function(assignment){
      return assignment.classId
    })

    uiState.expandedClassIds = assignedExpanded.length
      ? Array.from(new Set(assignedExpanded))
      : (bundleState.classes[0] ? [bundleState.classes[0].id] : [])
    uiState.initialized = true
  })
}

function isAssignmentCardExpanded(studySet, classId){
  return getStudySetUiState(studySet).expandedClassIds.indexOf(classId) >= 0
}

function toggleAssignmentCard(setIndex, classId){
  const studySet = bundleState.studySets[setIndex]
  if(!studySet) return

  const uiState = getStudySetUiState(studySet)
  const expanded = new Set(uiState.expandedClassIds || [])
  if(expanded.has(classId)) expanded.delete(classId)
  else expanded.add(classId)
  uiState.expandedClassIds = Array.from(expanded)
  uiState.initialized = true

  preserveViewport(renderSetEditor)
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
  if(checked) rememberPrepLastClassId(classId)
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
  const container = document.getElementById('import-class-targets')
  if(!container) return

  const targetIds = syncRotationImportClassIds(rotationImportClassIds)
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
  preserveViewport(function(){
    renderImportClassTargets()
    renderSummary()
    renderSetEditor()
  })
}

function updateClassId(index, value){
  const classInfo = bundleState.classes[index]
  if(!classInfo) return

  const previousId = String(classInfo.id || '').trim()
  const nextId = ensureUniqueClassId(normalizeClassIdValue(value, index), index)
  classInfo.id = nextId

  if(previousId && previousId !== nextId){
    syncPrepRememberedClassId(previousId, nextId)
    rotationImportClassIds = rotationImportClassIds.map(function(classId){
      return classId === previousId ? nextId : classId
    })

    Object.keys(studySetUiState).forEach(function(setId){
      const uiState = studySetUiState[setId]
      if(!uiState || !Array.isArray(uiState.expandedClassIds)) return
      uiState.expandedClassIds = uiState.expandedClassIds.map(function(classId){
        return classId === previousId ? nextId : classId
      })
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
  preserveViewport(renderAll)
}

function removeStudySet(index){
  bundleState.studySets.splice(index, 1)
  preserveViewport(renderAll)
}

function moveStudySet(index, direction){
  const nextIndex = index + direction
  if(index < 0 || nextIndex < 0 || nextIndex >= bundleState.studySets.length) return

  const movedStudySet = bundleState.studySets.splice(index, 1)[0]
  bundleState.studySets.splice(nextIndex, 0, movedStudySet)
  preserveViewport(renderAll)
}

function updateStudySetField(index, field, value){
  if(!bundleState.studySets[index]) return
  bundleState.studySets[index][field] = value
}

function toggleSetClassAssignment(setIndex, classId, checked){
  const studySet = bundleState.studySets[setIndex]
  if(!studySet) return

  const assignment = getClassAssignment(studySet, classId)
  if(!assignment) return

  const normalizedIndexes = normalizeNumberList(assignment.passageIndexes, studySet.passages.length)
  assignment.passageIndexes = checked
    ? (normalizedIndexes.length ? normalizedIndexes : getAllPassageIndexes(studySet))
    : []
  if(checked) rememberPrepLastClassId(classId)

  preserveViewport(renderSetEditor)
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
    summaryCard('Classes', String(bundleState.classes.length)),
    summaryCard('Sets', String(bundleState.studySets.length)),
    summaryCard('Text', String(passageCount)),
    summaryCard('Cards', String(cardCount))
  ].join('')
}

function renderClassEditor(){
  document.getElementById('add-class-btn').disabled = bundleState.classes.length >= 8

  document.getElementById('class-editor').innerHTML = bundleState.classes.map(function(classInfo, index){
    return '' +
      '<div class="class-row">' +
        '<div class="field">' +
          '<label>반 ID</label>' +
          '<input type="text" value="' + escapeAttr(classInfo.id) + '" onchange="updateClassId(' + index + ', this.value)">' +
        '</div>' +
        '<div class="field">' +
          '<label>반 이름</label>' +
          '<input type="text" value="' + escapeAttr(classInfo.name) + '" oninput="updateClassField(' + index + ', \'name\', this.value)">' +
        '</div>' +
        '<button class="btn btn-danger" type="button" onclick="removeClassConfig(' + index + ')"' + (bundleState.classes.length === 1 ? ' disabled' : '') + '>삭제</button>' +
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
    const canMoveUp = setIndex > 0
    const canMoveDown = setIndex < bundleState.studySets.length - 1
    const assignedClassCount = getAssignedClassCount(studySet)
    return '' +
      '<div class="editor-card">' +
        '<div class="editor-head">' +
          '<div>' +
            '<div class="editor-index">Set ' + (setIndex + 1) + '</div>' +
            '<div class="editor-meta">' + studySet.passages.length + '개 지문 · ' + escapeHtml(studySet.sourceName || '불러온 ROTATION 세션') + '</div>' +
          '</div>' +
          '<div class="editor-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" onclick="moveStudySet(' + setIndex + ', -1)"' + (canMoveUp ? '' : ' disabled') + '>위</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" onclick="moveStudySet(' + setIndex + ', 1)"' + (canMoveDown ? '' : ' disabled') + '>아래</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" onclick="removeStudySet(' + setIndex + ')">삭제</button>' +
          '</div>' +
        '</div>' +
        '<div class="set-field-stack">' +
          '<div>' +
            '<div class="field-label">세트 제목</div>' +
            '<input class="set-title-input" type="text" value="' + escapeAttr(studySet.title) + '" oninput="updateStudySetField(' + setIndex + ', \'title\', this.value)">' +
          '</div>' +
          '<div class="set-date-grid">' +
            '<div>' +
              '<div class="field-label">공개 시작일</div>' +
              '<input type="date" value="' + escapeAttr(studySet.startDate) + '" oninput="updateStudySetField(' + setIndex + ', \'startDate\', this.value)">' +
            '</div>' +
            '<div>' +
              '<div class="field-label">공개 종료일</div>' +
              '<input type="date" value="' + escapeAttr(studySet.endDate) + '" oninput="updateStudySetField(' + setIndex + ', \'endDate\', this.value)">' +
            '</div>' +
          '</div>' +
          '<div class="set-note">둘 다 비워 두면 항상 열립니다.</div>' +
          '<div>' +
            '<div class="field-label">배정 반</div>' +
            '<div class="set-assignment-meta">' + assignedClassCount + '개 반 배정</div>' +
            '<div class="class-checks">' + renderSetClassChecks(studySet, setIndex) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
  }).join('')
}

function renderSetClassChecks(studySet, setIndex){
  if(!bundleState.classes.length){
    return '<div class="empty-box" style="width:100%">먼저 왼쪽에서 반을 추가해 주세요.</div>'
  }

  return bundleState.classes.map(function(classInfo){
    const checked = isStudySetAssignedToClass(studySet, classInfo.id)
    return '' +
      '<label class="class-check">' +
        '<input type="checkbox" ' + (checked ? 'checked ' : '') + 'onchange="toggleSetClassAssignment(' + setIndex + ', \'' + escapeAttr(classInfo.id) + '\', this.checked)">' +
        '<span>' + escapeHtml(classInfo.name) + '</span>' +
      '</label>'
  }).join('')
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
}

function summaryCard(label, value){
  return '<div class="summary-card"><div class="summary-kicker">' + escapeHtml(label) + '</div><div class="summary-value">' + escapeHtml(value) + '</div></div>'
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
  const zone = document.getElementById('file-zone')
  const titleNode = document.getElementById('fz-title')
  const subNode = document.getElementById('fz-sub')
  if(!zone || !titleNode || !subNode) return

  zone.classList.add('loaded')
  titleNode.textContent = title
  subNode.textContent = sub
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
