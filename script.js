// ============================================
// InMyRoom - 방 인테리어 시뮬레이터 애플리케이션
// 사용자가 웹 브라우저에서 가구를 배치하고 방을 꾸밀 수 있는 애플리케이션
// ============================================

// 상수 정의 - 애플리케이션 전체에서 사용할 고정값들을 한 곳에 모아 관리
// 이렇게 상수를 분리하면 나중에 값을 변경할 때 한 곳에서만 수정하면 됨
const CONSTANTS = {
    FLOOR_HEIGHT: 120,              // 바닥의 높이(픽셀) - 가구 배치 시 바닥 영역 계산에 사용
    MIN_FURNITURE_SIZE: 20,         // 가구의 최소 크기(픽셀) - 가구가 너무 작아져서 보이지 않는 것을 방지
    MAX_FURNITURE_SIZE: 300,        // 가구의 최대 크기(픽셀) - 가구가 너무 커져서 화면을 벗어나는 것을 방지
    ROTATION_STEP: 15,              // 회전 시 각도 단위(도) - 가구 회전 시 15도씩 회전하여 정확한 배치 가능
    MOVEMENT_STEP: 1,               // 일반 이동 시 픽셀 단위 - 키보드로 가구를 미세 조정할 때 사용
    FAST_MOVEMENT_STEP: 10,         // 빠른 이동 시 픽셀 단위 - Shift 키와 함께 사용할 때 빠른 이동
    RESIZE_STEP: 10,                // 크기 조절 시 픽셀 단위 - 가구 크기를 늘리거나 줄일 때의 변화량
    CANVAS_PADDING: 5,              // 캔버스 가장자리 여백 - 가구가 경계에 너무 붙지 않도록 하는 안전 영역
    FLOOR_MARGIN: 5,                // 바닥과의 여백 - 가구가 바닥에 너무 붙지 않도록 하는 공간
    MAX_Z_INDEX: 10000              // 최대 z-index 값 - 가구의 앞뒤 배치 순서 관리의 시작점
};

// 바닥 스타일 정의
const FLOOR_STYLES = {
    // 기본 나무 바닥 스타일 
    default: {
        backgroundColor: '#deb887',         // 연한 갈색 배경
        borderTop: '4px solid #bfa16a'      // 상단에 어두운 갈색 테두리로 입체감 표현
    },
    // 어두운 나무 바닥 스타일 
    dark_wood: {
        backgroundColor: '#8b4513',         // 진한 갈색 배경
        borderTop: '4px solid #654321'      // 더 어두운 갈색 테두리로 깊이감 표현
    },
    // 타일 바닥 스타일
    tile: {
        backgroundColor: '#e0e0e0',         // 밝은 회색 배경
        borderTop: '4px solid #b0b0b0'      // 어두운 회색 테두리로 타일 경계 표현
    },
    // 카펫 바닥 스타일
    carpet: {
        backgroundColor: '#8b0000',         // 짙은 빨간색 
        borderTop: '4px solid #6b0000'      // 더 어두운 빨간색 테두리
    },
    // 대리석 바닥 스타일
    marble: {
        backgroundColor: '#f8f8f8',         // 거의 흰
        borderTop: '4px solid #d0d0d0'      // 연한 회색 테두리로 경계 표현
    }
};

// 에러 핸들링 유틸리티 클래스 - 애플리케이션 전체의 오류를 일관성 있게 처리
// 정적 클래스로 구현하여 어디서든 쉽게 오류 처리 가능
class ErrorHandler {
    // 오류 발생 시 호출되는 정적 메서드 - 개발자와 사용자 모두를 위한 오류 처리
    static handle(error, context = 'Unknown') {
        // 콘솔에 오류 정보를 출력 (개발자를 위한 디버깅 정보)
        // context를 포함하여 어느 부분에서 오류가 발생했는지 명확히 표시
        console.error(`[${context}] 오류:`, error);
        // 사용자에게 친화적인 오류 메시지 표시 (기술적 세부사항 숨김)
        this.showUserError(`${context}에서 오류가 발생했습니다: ${error.message}`);
    }

    // 사용자에게 오류 메시지를 표시하는 메서드
    // 접근성을 고려하여 스크린 리더 사용자도 오류를 인지할 수 있도록 구현
    static showUserError(message) {
        // 스크린 리더 사용자를 위한 접근성 영역에 메시지 전달
        // aria-live 속성을 가진 요소에 텍스트를 넣으면 자동으로 읽어줌
        const liveRegion = document.getElementById('a11y-live');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
        // 콘솔에도 오류 메시지 출력 (개발자가 브라우저 콘솔에서 확인 가능)
        console.error(message);
    }

    // 성공 메시지를 표시하는 메서드 - 사용자 액션이 성공했을 때 피드백 제공
    static showSuccess(message) {
        // 접근성 영역을 통해 성공 메시지 전달 (스크린 리더가 읽어줌)
        const liveRegion = document.getElementById('a11y-live');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }
}

// 상태 관리 클래스 - 애플리케이션의 모든 상태 정보를 중앙에서 관리
// MVC 패턴의 Model 역할을 하며, 데이터의 일관성을 보장
class AppState {
    constructor() {
        // Map을 사용하여 가구 정보를 효율적으로 저장 (ID를 키로 사용)
        // Array 대신 Map을 사용하는 이유: ID로 빠른 검색이 가능하고, 삭제/추가가 효율적
        this.furniture = new Map();
        // 현재 선택된 가구 참조 (null이면 선택된 가구 없음)
        // 하나의 가구만 선택 가능하도록 제한
        this.selectedFurniture = null;
        // 현재 드래그 중인지 여부를 나타내는 플래그
        // 드래그 중일 때 다른 상호작용을 방지하기 위해 사용
        this.isDragging = false;
        // 드래그 모드 ('new': 새 가구 배치, 'move': 기존 가구 이동)
        // 드래그 동작을 구분하여 적절한 처리를 하기 위함
        this.dragMode = null;
        // 가구 생성 시 고유 ID 생성을 위한 카운터
        // 가구가 삭제되어도 ID 중복을 방지하기 위해 계속 증가
        this.furnitureCounter = 0;
        // 현재 최대 z-index 값 (가구의 앞뒤 순서 관리)
        // 새 가구를 항상 가장 앞에 배치하기 위해 추적
        this.maxZIndex = CONSTANTS.MAX_Z_INDEX;
        // 배경 설정 정보 저장 객체
        this.background = {
            type: '',           // 배경 타입 (색상 코드 또는 'upload')
            imageData: null     // 업로드된 이미지 데이터 (Base64 인코딩된 문자열)
        };
        // 바닥 설정 정보 저장 객체
        this.floor = {
            type: 'default',    // 바닥 타입 (미리 정의된 스타일 또는 'upload')
            imageData: null     // 업로드된 바닥 이미지 데이터 (Base64 인코딩된 문자열)
        };
    }

    // 새 가구를 Map에 추가하는 메서드
    // ID와 가구 DOM 요소를 연결하여 추후 관리가 용이하도록 함
    addFurniture(id, furniture) {
        this.furniture.set(id, furniture);
    }

    // 가구를 Map에서 제거하는 메서드
    // 가구 삭제 시 메모리에서도 완전히 제거하여 메모리 누수 방지
    removeFurniture(id) {
        this.furniture.delete(id);
    }

    // ID로 특정 가구를 조회하는 메서드
    // 빠른 검색을 위해 Map의 get 메서드 활용
    getFurniture(id) {
        return this.furniture.get(id);
    }

    // 모든 가구를 배열로 반환하는 메서드
    // 전체 가구에 대한 일괄 처리가 필요할 때 사용 (예: 저장, 삭제 등)
    getAllFurniture() {
        return Array.from(this.furniture.values());
    }

    // 선택된 가구를 설정하는 메서드
    // 가구 선택 상태를 중앙에서 관리하여 일관성 보장
    setSelectedFurniture(furniture) {
        this.selectedFurniture = furniture;
    }

    // 현재 선택된 가구를 반환하는 메서드
    // 다양한 컴포넌트에서 현재 선택 상태를 확인할 때 사용
    getSelectedFurniture() {
        return this.selectedFurniture;
    }

    // 새 가구의 고유 ID를 생성하는 메서드
    // 'furniture-숫자' 형태로 생성하여 가독성과 고유성을 동시에 확보
    getNextFurnitureId() {
        return `furniture-${++this.furnitureCounter}`;
    }

    // 다음 z-index 값을 반환하는 메서드 (가구를 맨 앞으로 가져올 때 사용)
    // 새로 생성되거나 선택된 가구를 다른 가구들보다 앞에 표시하기 위함
    getNextZIndex() {
        return ++this.maxZIndex;
    }
}

// 바닥 관리 클래스 - 방의 바닥 스타일과 이미지를 관리
// 바닥은 시각적으로 공간감을 주는 중요한 요소로, 별도 클래스로 관리
class FloorManager {
    constructor(state) {
        this.state = state;         // AppState 인스턴스 참조로 바닥 상태 정보 접근
        this.floorElement = null;   // DOM의 바닥 요소 참조 (캐싱으로 성능 향상)
    }

    // 바닥 관리자 초기화 - DOM 요소 찾기 및 기본 스타일 적용
    init() {
        // CSS 선택자로 바닥 요소 찾기 (.floor 클래스를 가진 요소)
        this.floorElement = document.querySelector('.floor');
        if (!this.floorElement) {
            // 바닥 요소가 없으면 오류 발생 (필수 요소이므로 앱이 동작할 수 없음)
            throw new Error('바닥 요소를 찾을 수 없습니다');
        }
        // 현재 상태의 바닥 타입으로 스타일 적용 (초기화 시 기본값 적용)
        this.applyFloorStyle(this.state.floor.type);
    }

    // 바닥 스타일을 적용하는 핵심 메서드
    // 다양한 바닥 타입을 지원하며, 이미지와 색상 모두 처리 가능
    applyFloorStyle(floorType) {
        if (!this.floorElement) return; // 바닥 요소가 없으면 조기 반환

        try {
            // 바닥의 기본 CSS 속성들을 설정 (위치, 크기, 레이어 등)
            // Object.assign을 사용하여 여러 속성을 한 번에 설정 (성능상 유리)
            Object.assign(this.floorElement.style, {
                position: 'absolute',       // 절대 위치 지정으로 정확한 배치
                left: '0',                  // 왼쪽 끝에 배치
                right: '0',                 // 오른쪽 끝에 배치 (width: 100%와 동일 효과)
                bottom: '0',                // 바닥에 배치 (방의 아래쪽)
                width: '100%',              // 전체 너비 사용
                height: `${CONSTANTS.FLOOR_HEIGHT}px`, // 미리 정의된 높이 사용
                borderRadius: '0 0 12px 12px',         // 하단 모서리만 둥글게 (자연스러운 느낌)
                zIndex: '2',                // 가구보다는 뒤에, 배경보다는 앞에 배치
                display: 'block',           // 블록 요소로 표시
                visibility: 'visible',      // 화면에 표시
                opacity: '1',               // 완전 불투명
                pointerEvents: 'none'       // 마우스 이벤트 차단 (가구 선택 방해 방지)
            });

            // 이전 배경 스타일들을 모두 초기화 (깨끗한 상태에서 새 스타일 적용)
            // 이전 설정이 새 설정과 충돌하는 것을 방지
            this.floorElement.style.background = '';
            this.floorElement.style.backgroundColor = '';
            this.floorElement.style.backgroundImage = '';

            // 바닥 타입에 따라 적절한 스타일 적용
            if (floorType === 'upload' && this.state.floor.imageData) {
                // 사용자가 업로드한 이미지 사용
                this.applyImageFloor();
            } else if (FLOOR_STYLES[floorType]) {
                // 미리 정의된 스타일 사용 (default, dark_wood 등)
                Object.assign(this.floorElement.style, FLOOR_STYLES[floorType]);
            } else {
                // 정의되지 않은 타입이면 기본 스타일 사용 (안전장치)
                Object.assign(this.floorElement.style, FLOOR_STYLES.default);
            }

            // 바닥 요소에 타입 정보를 데이터 속성으로 저장 (CSS나 디버깅에서 활용)
            this.floorElement.dataset.floorType = floorType;
            // 상태 객체에도 바닥 타입 저장 (일관성 유지)
            this.state.floor.type = floorType;

            console.log(`바닥 스타일 적용 완료: ${floorType}`);
        } catch (error) {
            // 오류 발생 시 일관된 오류 처리
            ErrorHandler.handle(error, '바닥 스타일 적용');
        }
    }

    // 업로드된 이미지를 바닥에 적용하는 메서드
    // 이미지 배경 처리는 별도 메서드로 분리하여 코드 가독성 향상
    applyImageFloor() {
        if (!this.state.floor.imageData) return; // 이미지 데이터가 없으면 조기 반환

        // 이미지를 배경으로 설정하는 CSS 속성들
        Object.assign(this.floorElement.style, {
            backgroundImage: `url('${this.state.floor.imageData}')`,  // Base64 이미지 데이터 사용
            backgroundSize: 'cover',        // 이미지가 요소 전체를 덮도록 (비율 유지하며 크기 조정)
            backgroundPosition: 'center',   // 이미지를 중앙에 배치
            backgroundRepeat: 'no-repeat',  // 이미지 반복 없음 (하나의 이미지만 표시)
            borderTop: '4px solid #bfa16a'  // 상단 테두리 (입체감 표현)
        });
    }

    // 바닥 변경 요청을 처리하는 메서드
    // 사용자가 UI에서 바닥을 변경할 때 호출되는 진입점
    changeFloor(floorType) {
        if (floorType === 'upload') {
            // 'upload' 선택 시 파일 선택 다이얼로그 열기
            // 숨겨진 파일 입력 요소를 프로그래밍적으로 클릭
            document.getElementById('floorImageInput').click();
            return; // 파일 선택 후 별도 처리되므로 여기서 종료
        }

        // 일반 바닥 타입이면 바로 스타일 적용
        this.applyFloorStyle(floorType);
        // UI 드롭다운도 함께 업데이트 (사용자 인터페이스 일관성 유지)
        this.updateFloorSelect(floorType);
    }

    // 바닥 이미지 업로드를 처리하는 메서드
    // 비동기 파일 읽기를 통해 이미지를 Base64로 변환
    handleFloorImageUpload(file) {
        if (!file) return; // 파일이 선택되지 않으면 조기 반환

        // FileReader를 사용하여 파일을 Base64로 변환
        // Base64를 사용하는 이유: 별도 서버 없이 브라우저에서 이미지 처리 가능
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // 변환된 이미지 데이터를 상태에 저장
                this.state.floor.imageData = e.target.result; // Base64 인코딩된 이미지 데이터
                this.state.floor.type = 'upload';
                // 업로드 타입으로 스타일 적용
                this.applyFloorStyle('upload');

                // 사용자에게 업로드 완료 피드백 제공
                // 파일명을 표시하여 어떤 이미지가 업로드되었는지 알려줌
                const feedbackSpan = document.getElementById('floorImageName');
                if (feedbackSpan) {
                    feedbackSpan.textContent = `업로드됨: ${file.name}`;
                }

                // 접근성을 위한 성공 메시지 (스크린 리더 사용자 포함)
                ErrorHandler.showSuccess('바닥 이미지가 업로드되었습니다');
            } catch (error) {
                ErrorHandler.handle(error, '바닥 이미지 업로드');
            }
        };
        // 파일 읽기 실패 시 오류 처리
        reader.onerror = () => {
            ErrorHandler.handle(new Error('이미지 파일을 읽을 수 없습니다'), '바닥 이미지 업로드');
        };
        // 파일을 Data URL(Base64) 형태로 읽기 시작
        reader.readAsDataURL(file);
    }

    // UI의 바닥 선택 드롭다운을 업데이트하는 메서드
    // 프로그래밍적으로 바닥이 변경될 때 UI 동기화를 위해 필요
    updateFloorSelect(value) {
        const floorSelect = document.getElementById('floorSelect');
        // 드롭다운이 존재하고 현재 값과 다를 때만 업데이트 (무한 루프 방지)
        if (floorSelect && floorSelect.value !== value) {
            floorSelect.value = value;
        }
    }
}

// 배경 관리 클래스 - 방의 배경색이나 배경 이미지를 관리
class BackgroundManager {
    constructor(state) {
        this.state = state;         // AppState 인스턴스 참조
        this.canvasElement = null;  // DOM의 캔버스 요소 참조 (배경이 적용될 요소)
    }

    // 배경 관리자 초기화 - 캔버스 요소 찾기
    init() {
        this.canvasElement = document.getElementById('roomCanvas');
        if (!this.canvasElement) {
            // 캔버스 요소는 배경과 가구 배치의 기반이 되므로 필수
            throw new Error('캔버스 요소를 찾을 수 없습니다');
        }
    }

    // 배경 변경을 처리하는 메서드
    // 색상 배경과 이미지 배경을 모두 지원
    changeBackground(value) {
        try {
            console.log('changeBackground 호출됨:', value); // 디버깅 로그
            console.log('canvasElement:', this.canvasElement); // 디버깅 로그
            
            // 기존 배경 스타일들을 모두 초기화 (새로운 배경과의 충돌 방지)
            // background 속성 전체를 덮어써야 CSS 우선순위 문제 해결
            this.canvasElement.style.setProperty('background', '', 'important');
            this.clearBackgroundFeedback();
            this.state.background.type = value;
            this.state.background.imageData = null; // 새 배경 설정 시 이전 이미지 데이터 제거

            if (value === 'upload') {
                // 이미지 업로드 선택 시 파일 다이얼로그 열기
                console.log('파일 업로드 다이얼로그 열기'); // 디버깅 로그
                document.getElementById('bgImageInput').click();
            } else if (value === '') {
                // 기본 선택 시 - 그라데이션 배경 복구
                const gradientValue = 'linear-gradient(135deg, #F0F8FF 0%, #E6F3FF 100%)';
                this.canvasElement.style.setProperty('background', gradientValue, 'important');
                console.log('기본 배경으로 설정됨 (그라데이션 복구):', gradientValue); // 디버깅 로그
            } else if (value.startsWith('#')) {
                // 색상 코드인 경우 (예: #ffffff) 배경색으로 설정
                this.canvasElement.style.setProperty('background', value, 'important');
                console.log(`배경색 설정: ${value}`); // 디버깅 로그
            } else {
                // 그 외의 경우 기본 흰색 배경 (안전장치)
                this.canvasElement.style.setProperty('background', '#ffffff', 'important');
                console.log('기본 흰색 배경 설정'); // 디버깅 로그
            }
        } catch (error) {
            ErrorHandler.handle(error, '배경 변경');
        }
    }    

    // 배경 이미지 업로드를 처리하는 메서드
    // 바닥 이미지 업로드와 유사하지만 배경에 특화된 처리
    handleBackgroundImageUpload(file) {
        console.log('handleBackgroundImageUpload 호출됨:', file); // 디버깅 로그
        if (!file) return; // 파일이 선택되지 않으면 조기 반환

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                console.log('파일 읽기 완료, 이미지 데이터 길이:', e.target.result.length); // 디버깅 로그
                
                // 변환된 이미지 데이터를 상태에 저장
                this.state.background.imageData = e.target.result;
                this.state.background.type = 'upload';

                // 캔버스 배경으로 이미지 설정 - background 속성 전체 사용
                const backgroundValue = `url('${e.target.result}') center/cover no-repeat`;
                this.canvasElement.style.setProperty('background', backgroundValue, 'important');
                console.log('배경 이미지 설정 완료:', backgroundValue.substring(0, 50) + '...'); // 디버깅 로그

                // 사용자에게 업로드 완료 피드백
                const feedbackSpan = document.getElementById('bgImageName');
                if (feedbackSpan) {
                    feedbackSpan.textContent = `업로드됨: ${file.name}`;
                }

                ErrorHandler.showSuccess('배경 이미지가 업로드되었습니다');
            } catch (error) {
                ErrorHandler.handle(error, '배경 이미지 업로드');
            }
        };
        // 파일 읽기 실패 시 오류 처리
        reader.onerror = () => {
            ErrorHandler.handle(new Error('이미지 파일을 읽을 수 없습니다'), '배경 이미지 업로드');
        };
        // 파일을 Data URL로 읽기 시작
        reader.readAsDataURL(file);
    }

    // 배경 업로드 피드백을 지우는 메서드
    clearBackgroundFeedback() {
        const feedbackSpan = document.getElementById('bgImageName');
        if (feedbackSpan) {
            feedbackSpan.textContent = '';
        }
    }
}

// 가구 관리 클래스 - 가구의 생성, 선택, 조작, 삭제를 담당
// 애플리케이션의 핵심 기능으로, 사용자가 가장 많이 상호작용하는 부분
class FurnitureManager {
    constructor(state) {
        this.state = state;         // AppState 인스턴스 참조
        this.roomCanvas = null;     // 가구가 배치될 캔버스 요소
        this.dragOffset = { x: 0, y: 0 }; // 드래그 시 마우스와 가구의 상대 위치 저장
    }

    // 가구 관리자 초기화 - 필수 DOM 요소 찾기
    init() {
        this.roomCanvas = document.getElementById('roomCanvas');
        if (!this.roomCanvas) {
            // 룸 캔버스는 가구 배치의 기본 영역이므로 필수
            throw new Error('룸 캔버스 요소를 찾을 수 없습니다');
        }

        // 초기 상태에서 컨트롤 패널 비활성화 (가구가 선택되지 않은 상태)
        this.disableControlPanel();
    }

    // 새 가구를 생성하는 메서드 - 가구 객체의 전체 생성 과정 담당
    createFurniture(type, width, height, x = 0, y = 0) {
        try {
            // 고유한 가구 ID 생성 (중복 방지를 위해 카운터 사용)
            const furnitureId = this.state.getNextFurnitureId();
            // 가구를 나타낼 div 요소 생성 (DOM 조작의 기본 단위)
            const furniture = document.createElement('div');

            // 가구 요소의 클래스와 데이터 속성 설정
            furniture.className = 'placed-furniture';      // CSS 스타일링을 위한 클래스명
            furniture.dataset.type = type;                 // 가구 타입을 데이터 속성으로 저장
            furniture.dataset.id = furnitureId;            // 고유 ID를 데이터 속성으로 저장

            // 접근성을 위한 ARIA 속성들 설정 (스크린 리더 지원)
            furniture.setAttribute('role', 'button');      // 스크린 리더에게 버튼으로 인식시킴
            furniture.setAttribute('aria-label', `${this.getFurnitureTypeLabel(type)} 가구`);
            furniture.setAttribute('tabindex', '0');       // 키보드로 포커스 가능하게 설정

            // 가구의 위치와 크기, 레이어 설정 (CSS 인라인 스타일 사용)
            Object.assign(furniture.style, {
                width: width + 'px',        // 가구 너비 설정
                height: height + 'px',      // 가구 높이 설정
                left: x + 'px',            // X 좌표 (캔버스 내 절대 위치)
                top: y + 'px',             // Y 좌표 (캔버스 내 절대 위치)
                zIndex: this.state.getNextZIndex(), // 가장 앞 레이어로 설정 (새 가구는 항상 앞에)
                position: 'absolute'        // 절대 위치 지정으로 자유로운 배치
            });

            // 가구 이미지를 표시할 img 요소 생성
            const img = document.createElement('img');
            img.src = `image/${type}.png`;        // 가구 타입에 따른 이미지 파일 경로
            img.className = 'furniture-preview-img'; // CSS 스타일링용 클래스명
            img.alt = this.getFurnitureTypeLabel(type); // 접근성을 위한 대체 텍스트
            furniture.appendChild(img);            // 가구 요소에 이미지 자식으로 추가

            // 가구 클릭 시 선택되도록 이벤트 리스너 추가
            furniture.addEventListener('click', (e) => {
                e.stopPropagation();              // 이벤트 버블링 방지 (부모 요소로 전파 차단)
                this.selectFurniture(furniture);  // 클릭된 가구를 선택 상태로 변경
            });

            // 메모리 누수 방지를 위한 정리 함수를 요소에 저장
            // 가구 삭제 시 이벤트 리스너도 함께 제거하기 위함
            furniture._cleanup = () => {
                furniture.removeEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectFurniture(furniture);
                });
            };

            // 생성된 가구를 상태 관리 객체에 추가
            this.state.addFurniture(furnitureId, furniture);
            return furniture; // 생성된 가구 요소 반환
        } catch (error) {
            ErrorHandler.handle(error, '가구 생성');
            return null; // 오류 발생 시 null 반환
        }
    }

    // 가구를 삭제하는 메서드 - 완전한 정리 작업 포함
    deleteFurniture(furniture) {
        if (!furniture) return; // 가구가 없으면 조기 반환

        try {
            const furnitureId = furniture.dataset.id;

            // 이벤트 리스너 정리 (메모리 누수 방지)
            // 가구 생성 시 추가된 cleanup 함수 실행
            if (furniture._cleanup) {
                furniture._cleanup();
            }

            // 상태 관리 객체에서 가구 정보 제거
            this.state.removeFurniture(furnitureId);

            // 삭제될 가구가 현재 선택된 가구라면 선택 해제
            if (this.state.getSelectedFurniture() === furniture) {
                this.deselectFurniture();
            }

            // DOM에서 가구 요소 완전 제거
            furniture.remove();

            // 사용자에게 삭제 완료 피드백
            ErrorHandler.showSuccess('가구가 삭제되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '가구 삭제');
        }
    }

    // 가구를 선택하는 메서드 - 선택 상태 관리와 UI 업데이트
    selectFurniture(furniture) {
        try {
            // 기존 선택 해제
            this.deselectFurniture();

            // 새 가구 선택
            this.state.setSelectedFurniture(furniture);
            furniture.classList.add('selected');

            // 선택 정보 업데이트
            this.updateSelectionInfo();

            // 선택 패널 표시
            this.showSelectionPanel();

            // 컨트롤 패널 활성화
            this.enableControlPanel();

        } catch (error) {
            ErrorHandler.handle(error, '가구 선택');
        }
    }

    // 가구 선택 해제 시 호출되는 메서드
    deselectFurniture() {
        try {
            // 기존 선택된 가구의 선택 표시 제거
            const selectedFurniture = this.state.getSelectedFurniture();
            if (selectedFurniture) {
                selectedFurniture.classList.remove('selected');
            }

            // 상태에서 선택된 가구 제거
            this.state.setSelectedFurniture(null);

            // 선택 정보 초기화
            this.updateSelectionInfo();

            // 선택 패널 숨기기
            this.hideSelectionPanel();

            // 컨트롤 패널 비활성화
            this.disableControlPanel();

        } catch (error) {
            ErrorHandler.handle(error, '가구 선택 해제');
        }
    }

    // 선택된 가구의 정보를 UI에 업데이트하는 메서드
    // 사용자가 현재 선택된 가구의 상태를 확인할 수 있도록 함
    updateSelectionInfo() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return; // 선택된 가구가 없으면 조기 반환

        try {
            // 가구의 현재 속성값들 읽기 (CSS 스타일에서 추출)
            const type = furniture.dataset.type || 'unknown';          // 가구 타입
            const left = parseInt(furniture.style.left) || 0;          // X 좌표
            const top = parseInt(furniture.style.top) || 0;            // Y 좌표
            const width = parseInt(furniture.style.width) || 0;        // 너비
            const height = parseInt(furniture.style.height) || 0;      // 높이
            const transform = furniture.style.transform || 'rotate(0deg)'; // 회전 상태
            const zIndex = furniture.style.zIndex || 'auto';           // 레이어 순서

            // UI 정보 표시 요소들을 한 번에 찾기 (성능 최적화)
            const elements = {
                selectedType: document.getElementById('selectedType'),
                selectedPosition: document.getElementById('selectedPosition'),
                selectedSize: document.getElementById('selectedSize'),
                selectedRotation: document.getElementById('selectedRotation'),
                selectedLayer: document.getElementById('selectedLayer')
            };

            // 각 UI 요소에 가구 정보 표시 (요소가 존재할 때만 업데이트)
            if (elements.selectedType) elements.selectedType.textContent = this.getFurnitureTypeLabel(type);
            if (elements.selectedPosition) elements.selectedPosition.textContent = `(${left}, ${top})`;
            if (elements.selectedSize) elements.selectedSize.textContent = `${width} × ${height}`;
            if (elements.selectedRotation) elements.selectedRotation.textContent = transform;
            if (elements.selectedLayer) elements.selectedLayer.textContent = zIndex;
        } catch (error) {
            ErrorHandler.handle(error, '선택 정보 업데이트');
        }
    }

    // 가구 조작 패널을 화면에 표시하는 메서드
    showSelectionPanel() {
        const panel = document.getElementById('selectionInfo');
        if (panel) {
            panel.classList.remove('hidden'); // 숨김 클래스 제거로 패널 표시
        }
    }

    // 가구 조작 패널을 화면에서 숨기는 메서드
    hideSelectionPanel() {
        const panel = document.getElementById('selectionInfo');
        if (panel) {
            panel.classList.add('hidden'); // 숨김 클래스 추가로 패널 숨김
        }
    }

    // 가구 타입을 한국어로 변환하는 메서드
    // 사용자 친화적인 인터페이스를 위해 영어 타입명을 한국어로 변환
    getFurnitureTypeLabel(type) {
        // 가구 타입별 한국어 라벨 매핑 객체
        const labels = {
            chair: '의자',
            chair_2: '의자2',
            chair_3: '의자3',
            table: '테이블',
            bed: '침대',
            sofa: '소파',
            window: '창문',
            window_2: '창문2',
            window_3: '창문3',
            window_4: '창문4',
            door: '문',
            door_2: '문2',
            door_3: '문3',
            door_4: '문4',
            picture: '그림',
            plant: '식물',
            basil: '바질',
            lamp: '램프'
        };
        // 매핑된 라벨이 있으면 반환, 없으면 원본 타입 반환 (안전장치)
        return labels[type] || type;
    }

    // ============================================
    // 가구 조작 메서드들 - 선택된 가구를 조작하는 기능들
    // 사용자가 가구를 세밀하게 조정할 수 있는 기능 제공
    // ============================================

    // 선택된 가구를 앞으로 가져오는 메서드 (다른 가구 위에 표시)
    bringForward() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return; // 선택된 가구가 없으면 조기 반환

        try {
            // 현재 z-index 값 가져오기 (없으면 현재 최대값 사용)
            const currentZ = parseInt(furniture.style.zIndex) || this.state.maxZIndex;
            // z-index를 1 증가시켜 다른 가구들보다 앞으로 가져오기
            const newZ = currentZ + 1;
            furniture.style.zIndex = newZ;
            // 전체 최대 z-index 값 업데이트 (다음 가구를 위해)
            this.state.maxZIndex = Math.max(this.state.maxZIndex, newZ);
            // UI에 변경된 정보 즉시 반영
            this.updateSelectionInfo();
        } catch (error) {
            ErrorHandler.handle(error, '가구 앞으로 이동');
        }
    }

    // 선택된 가구를 뒤로 보내는 메서드 (다른 가구 아래에 표시)
    sendBackward() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const currentZ = parseInt(furniture.style.zIndex) || this.state.maxZIndex;
            // z-index가 10보다 클 때만 감소 (너무 뒤로 가서 보이지 않는 것 방지)
            if (currentZ > 10) {
                furniture.style.zIndex = currentZ - 1;
                this.updateSelectionInfo();
            }
        } catch (error) {
            ErrorHandler.handle(error, '가구 뒤로 이동');
        }
    }

    // 선택된 가구를 왼쪽으로 회전시키는 메서드
    rotateLeft() {
        this.rotateFurniture(-CONSTANTS.ROTATION_STEP); // 음수로 반시계방향 회전
    }

    // 선택된 가구를 오른쪽으로 회전시키는 메서드
    rotateRight() {
        this.rotateFurniture(CONSTANTS.ROTATION_STEP); // 양수로 시계방향 회전
    }

    // 가구를 지정된 각도만큼 회전시키는 메서드
    // CSS transform의 rotate 함수를 사용하여 부드러운 회전 효과
    rotateFurniture(degrees) {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            // 현재 회전 상태를 transform 스타일에서 추출
            const currentRotation = furniture.style.transform || 'rotate(0deg)';
            // 정규식으로 현재 각도 값 파싱 (예: "rotate(45deg)" → 45)
            const match = currentRotation.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
            const currentAngle = match ? parseFloat(match[1]) : 0;
            // 새로운 각도 계산 (기존 각도 + 회전할 각도)
            const newAngle = currentAngle + degrees;
            // 새로운 회전 변환 적용
            furniture.style.transform = `rotate(${newAngle}deg)`;
            this.updateSelectionInfo(); // UI 정보 업데이트
        } catch (error) {
            ErrorHandler.handle(error, '가구 회전');
        }
    }

    // 선택된 가구를 작게 만드는 메서드
    resizeSmaller() {
        this.resizeFurniture(-CONSTANTS.RESIZE_STEP); // 음수로 크기 감소
    }

    // 선택된 가구를 크게 만드는 메서드
    resizeBigger() {
        this.resizeFurniture(CONSTANTS.RESIZE_STEP); // 양수로 크기 증가
    }

    // 가구 크기를 조절하는 메서드
    // 최소/최대 크기 제한을 두어 적절한 범위 내에서만 크기 조절 가능
    resizeFurniture(sizeChange) {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            // 현재 가구의 너비와 높이 가져오기
            const currentWidth = parseInt(furniture.style.width) || 60;   // 기본값 60px
            const currentHeight = parseInt(furniture.style.height) || 60; // 기본값 60px

            // 새로운 크기 계산 (최소/최대 크기 제한 적용)
            // Math.max와 Math.min을 조합하여 범위 제한
            const newWidth = Math.max(CONSTANTS.MIN_FURNITURE_SIZE,
                Math.min(CONSTANTS.MAX_FURNITURE_SIZE, currentWidth + sizeChange));
            const newHeight = Math.max(CONSTANTS.MIN_FURNITURE_SIZE,
                Math.min(CONSTANTS.MAX_FURNITURE_SIZE, currentHeight + sizeChange));

            // 크기가 실제로 변경되었을 때만 적용 (불필요한 DOM 조작 방지)
            if (newWidth !== currentWidth || newHeight !== currentHeight) {
                furniture.style.width = newWidth + 'px';
                furniture.style.height = newHeight + 'px';
                this.updateSelectionInfo();
            }
        } catch (error) {
            ErrorHandler.handle(error, '가구 크기 조절');
        }
    }

    // 선택된 가구를 지정된 거리만큼 이동시키는 메서드
    // 키보드 화살표 키나 조작 버튼으로 정밀한 이동 가능
    moveFurniture(deltaX, deltaY) {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            // 현재 가구의 위치와 크기 정보 가져오기
            const currentLeft = parseInt(furniture.style.left) || 0;
            const currentTop = parseInt(furniture.style.top) || 0;
            const width = parseInt(furniture.style.width) || 60;
            const height = parseInt(furniture.style.height) || 60;

            // 캔버스의 경계 계산 (가구가 화면 밖으로 나가지 않도록)
            const canvasRect = this.roomCanvas.getBoundingClientRect();
            const maxX = canvasRect.width - width - CONSTANTS.CANVAS_PADDING;
            const maxY = canvasRect.height - height - CONSTANTS.CANVAS_PADDING;

            // 새로운 위치 계산 (경계 내에서만 이동 가능)
            // Math.max와 Math.min을 사용하여 범위 제한
            const newLeft = Math.max(CONSTANTS.CANVAS_PADDING,
                Math.min(currentLeft + deltaX, maxX));
            const newTop = Math.max(CONSTANTS.CANVAS_PADDING,
                Math.min(currentTop + deltaY, maxY));

            // 새로운 위치 적용
            furniture.style.left = newLeft + 'px';
            furniture.style.top = newTop + 'px';
            this.updateSelectionInfo(); // UI 위치 정보 업데이트
        } catch (error) {
            ErrorHandler.handle(error, '가구 이동');
        }
    }

    // ============================================
    // 가구 정렬 메서드들 - 선택된 가구를 정렬하는 기능들
    // 드래그로 대략 배치한 후 마무리 정렬에 유용
    // ============================================

    // 선택된 가구를 왼쪽으로 정렬하는 메서드
    alignLeft() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const width = parseInt(furniture.style.width) || 60;
            const newLeft = CONSTANTS.CANVAS_PADDING;
            
            furniture.style.left = newLeft + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 왼쪽으로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '왼쪽 정렬');
        }
    }

    // 선택된 가구를 가운데로 정렬하는 메서드
    alignCenter() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const canvasRect = this.roomCanvas.getBoundingClientRect();
            const width = parseInt(furniture.style.width) || 60;
            const newLeft = (canvasRect.width - width) / 2;
            
            furniture.style.left = newLeft + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 가운데로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '가운데 정렬');
        }
    }

    // 선택된 가구를 오른쪽으로 정렬하는 메서드
    alignRight() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const canvasRect = this.roomCanvas.getBoundingClientRect();
            const width = parseInt(furniture.style.width) || 60;
            const newLeft = canvasRect.width - width - CONSTANTS.CANVAS_PADDING;
            
            furniture.style.left = newLeft + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 오른쪽으로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '오른쪽 정렬');
        }
    }

    // 선택된 가구를 상단으로 정렬하는 메서드
    alignTop() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const newTop = CONSTANTS.CANVAS_PADDING;
            
            furniture.style.top = newTop + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 상단으로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '상단 정렬');
        }
    }

    // 선택된 가구를 중앙으로 정렬하는 메서드
    alignMiddle() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const canvasRect = this.roomCanvas.getBoundingClientRect();
            const height = parseInt(furniture.style.height) || 60;
            const floorHeight = CONSTANTS.FLOOR_HEIGHT;
            const availableHeight = canvasRect.height - floorHeight - CONSTANTS.CANVAS_PADDING * 2;
            const newTop = CONSTANTS.CANVAS_PADDING + (availableHeight - height) / 2;
            
            furniture.style.top = newTop + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 중앙으로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '중앙 정렬');
        }
    }

    // 선택된 가구를 하단으로 정렬하는 메서드 (바닥 위)
    alignBottom() {
        const furniture = this.state.getSelectedFurniture();
        if (!furniture) return;

        try {
            const canvasRect = this.roomCanvas.getBoundingClientRect();
            const height = parseInt(furniture.style.height) || 60;
            const floorHeight = CONSTANTS.FLOOR_HEIGHT;
            const newTop = canvasRect.height - floorHeight - height - CONSTANTS.CANVAS_PADDING;
            
            furniture.style.top = newTop + 'px';
            this.updateSelectionInfo();
            
            ErrorHandler.showSuccess('가구가 하단으로 정렬되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '하단 정렬');
        }
    }

    // 가구가 선택되지 않았을 때 사용자에게 안내 메시지 표시
    showNoSelectionMessage() {
        ErrorHandler.showUserError('가구를 먼저 선택해주세요.');
    }

    // 컨트롤 패널 활성화 메서드
    enableControlPanel() {
        const controlButtons = [
            'bringForward', 'sendBackward',
            'rotateLeft', 'rotateRight',
            'resizeSmaller', 'resizeBigger',
            'alignLeft', 'alignCenter', 'alignRight',
            'alignTop', 'alignMiddle', 'alignBottom',
            'deleteSelected'
        ];

        controlButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.classList.remove('disabled');
            }
        });
    }

    // 컨트롤 패널 비활성화 메서드
    disableControlPanel() {
        const controlButtons = [
            'bringForward', 'sendBackward',
            'rotateLeft', 'rotateRight',
            'resizeSmaller', 'resizeBigger',
            'alignLeft', 'alignCenter', 'alignRight',
            'alignTop', 'alignMiddle', 'alignBottom',
            'deleteSelected'
        ];

        controlButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    }
}

// 드래그 앤 드롭 관리 클래스 - 마우스로 가구를 끌어서 배치하고 이동하는 기능
// 직관적인 사용자 인터페이스의 핵심 기능으로, 자연스러운 조작감 제공
class DragDropManager {
    constructor(state, furnitureManager) {
        this.state = state;                 // AppState 인스턴스 참조
        this.furnitureManager = furnitureManager; // FurnitureManager 인스턴스 참조
        this.roomCanvas = null;             // 가구가 배치될 캔버스 요소
        this.sidebar = null;                // 가구 목록이 있는 사이드바 요소
        this.dragOffset = { x: 0, y: 0 };   // 드래그 시 마우스와 가구의 상대 위치

        // 이벤트 핸들러를 미리 바인딩 (메모리 효율성과 이벤트 제거를 위해)
        // 화살표 함수로 this 바인딩을 보장하고, 나중에 removeEventListener에서 사용
        this._boundOnGlobalDrag = (e) => this.onGlobalDrag(e);
        this._boundOnGlobalDragEnd = (e) => this.onGlobalDragEnd(e);
    }

    // 드래그 앤 드롭 관리자 초기화
    init() {
        this.roomCanvas = document.getElementById('roomCanvas');
        this.sidebar = document.querySelector('.sidebar');

        if (!this.roomCanvas || !this.sidebar) {
            throw new Error('필수 DOM 요소를 찾을 수 없습니다');
        }

        this.setupEventListeners(); // 이벤트 리스너 설정
    }

    // 드래그 앤 드롭 관련 이벤트 리스너들을 설정하는 메서드
    // 이벤트 위임 방식을 사용하여 동적으로 생성되는 요소도 처리 가능
    setupEventListeners() {
        // 사이드바에서 새 가구 드래그 시작 (이벤트 위임 방식 사용)
        // 상위 요소에 이벤트를 등록하여 하위 요소들의 이벤트를 한 번에 처리
        this.sidebar.addEventListener('mousedown', (e) => {
            // 클릭된 요소가 가구 아이템인지 확인 (closest로 상위 요소까지 탐색)
            const item = e.target.closest('.furniture-item');
            if (item) {
                this.startDragNewFurniture(e, item);
            }
        });

        // 캔버스에서 배치된 가구 드래그 시작 (이벤트 위임 방식 사용)
        this.roomCanvas.addEventListener('mousedown', (e) => {
            // 클릭된 요소가 배치된 가구인지 확인
            const target = e.target.closest('.placed-furniture');
            if (target) {
                e.preventDefault(); // 기본 동작 방지 (텍스트 선택, 이미지 드래그 등)
                this.startDragPlacedFurniture(e, target);
            }
        });

        // 캔버스 빈 공간 클릭 시 가구 선택 해제
        this.roomCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    // 사이드바에서 새 가구를 드래그하기 시작할 때 호출되는 메서드
    // 새 가구를 생성하면서 동시에 드래그 상태로 전환
    startDragNewFurniture(e, furnitureItem) {
        if (this.state.isDragging) return; // 이미 드래그 중이면 무시 (중복 방지)

        try {
            e.preventDefault(); // 기본 동작 방지

            // 가구 아이템에서 타입과 크기 정보 가져오기
            const type = furnitureItem.dataset.type;
            const width = parseInt(furnitureItem.dataset.width) || 60;   // 기본값 60px
            const height = parseInt(furnitureItem.dataset.height) || 60; // 기본값 60px

            // 마우스 위치를 기준으로 가구를 생성할 위치 계산
            const rect = this.roomCanvas.getBoundingClientRect();
            // 가구 중앙이 마우스 위치에 오도록 조정하고, 경계 내에 배치
            const x = Math.max(CONSTANTS.CANVAS_PADDING,
                Math.min(e.clientX - rect.left - width / 2,
                    rect.width - width - CONSTANTS.CANVAS_PADDING));
            const y = Math.max(CONSTANTS.CANVAS_PADDING,
                Math.min(e.clientY - rect.top - height / 2,
                    rect.height - height - CONSTANTS.CANVAS_PADDING));

            // 새 가구 생성
            const newFurniture = this.furnitureManager.createFurniture(type, width, height, x, y);
            if (!newFurniture) return; // 생성 실패 시 조기 반환

            // 드래그 상태 설정
            this.state.isDragging = true;
            this.state.dragMode = 'new'; // 새 가구 배치 모드
            newFurniture.classList.add('dragging'); // 드래그 중임을 나타내는 CSS 클래스

            // 생성된 가구를 캔버스에 추가하고 선택
            this.roomCanvas.appendChild(newFurniture);
            this.furnitureManager.selectFurniture(newFurniture);

            // 전역 마우스 이벤트 리스너 추가 (문서 전체에서 드래그 추적)
            // document에 등록하여 마우스가 캔버스를 벗어나도 드래그 계속 추적
            document.addEventListener('mousemove', this._boundOnGlobalDrag);
            document.addEventListener('mouseup', this._boundOnGlobalDragEnd);
        } catch (error) {
            ErrorHandler.handle(error, '새 가구 드래그 시작');
        }
    }

    // 이미 배치된 가구를 드래그하기 시작할 때 호출되는 메서드
    // 기존 가구의 위치를 변경하는 기능
    startDragPlacedFurniture(e, furniture) {
        if (this.state.isDragging) return; // 이미 드래그 중이면 무시

        try {
            e.preventDefault();
            e.stopPropagation(); // 이벤트 전파 중단 (다른 클릭 이벤트와 충돌 방지)

            // 드래그 상태 설정
            this.state.isDragging = true;
            this.state.dragMode = 'move'; // 기존 가구 이동 모드
            this.furnitureManager.selectFurniture(furniture); // 드래그할 가구 선택
            furniture.classList.add('dragging'); // 드래그 중 시각적 표시

            // 마우스와 가구의 상대적 위치 계산 (드래그 시 가구가 마우스를 따라 자연스럽게 움직이도록)
            // 가구를 클릭한 지점을 기준으로 상대 위치를 저장하여, 드래그 중에도 같은 지점이 마우스를 따라가도록 함
            const furnitureRect = furniture.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - furnitureRect.left, // 마우스 X 좌표 - 가구 왼쪽 경계
                y: e.clientY - furnitureRect.top   // 마우스 Y 좌표 - 가구 상단 경계
            };

            // 전역 마우스 이벤트 리스너 추가 (문서 전체에서 드래그 추적)
            document.addEventListener('mousemove', this._boundOnGlobalDrag);
            document.addEventListener('mouseup', this._boundOnGlobalDragEnd);
        } catch (error) {
            ErrorHandler.handle(error, '가구 드래그 시작');
        }
    }

    // 마우스가 움직일 때마다 호출되는 드래그 처리 메서드
    // 실시간으로 가구 위치를 업데이트하여 부드러운 드래그 효과 제공
    onGlobalDrag(e) {
        if (!this.state.isDragging || !this.state.selectedFurniture) return; // 드래그 중이 아니거나 선택된 가구가 없으면 무시

        try {
            e.preventDefault(); // 기본 동작 방지

            const rect = this.roomCanvas.getBoundingClientRect(); // 캔버스의 현재 위치와 크기
            const furniture = this.state.selectedFurniture;
            const width = parseInt(furniture.style.width) || 60;   // 가구 너비
            const height = parseInt(furniture.style.height) || 60; // 가구 높이

            let x, y; // 가구의 새로운 위치

            if (this.state.dragMode === 'new') {
                // 새 가구 배치 시: 가구 중앙이 마우스 위치에 오도록
                x = e.clientX - rect.left - width / 2;
                y = e.clientY - rect.top - height / 2;
            } else if (this.state.dragMode === 'move') {
                // 기존 가구 이동 시: 드래그 시작할 때의 상대 위치 유지
                // 처음 클릭한 지점과 마우스의 관계를 유지하여 자연스러운 드래그
                x = e.clientX - rect.left - this.dragOffset.x;
                y = e.clientY - rect.top - this.dragOffset.y;
            }

            // 캔버스 경계 내에서만 이동 가능하도록 제한
            // 가구가 캔버스를 벗어나거나 바닥 영역에 침범하지 않도록 경계 계산
            const maxX = rect.width - width - CONSTANTS.CANVAS_PADDING;
            const maxY = rect.height - height - CONSTANTS.CANVAS_PADDING;

            // Math.max와 Math.min을 사용하여 범위 제한 적용
            x = Math.max(CONSTANTS.CANVAS_PADDING, Math.min(x, maxX));
            y = Math.max(CONSTANTS.CANVAS_PADDING, Math.min(y, maxY));

            // 계산된 위치로 가구 이동 (CSS left, top 속성 변경)
            furniture.style.left = x + 'px';
            furniture.style.top = y + 'px';

            // UI에 실시간으로 위치 정보 업데이트 (사용자가 현재 위치를 확인 가능)
            this.furnitureManager.updateSelectionInfo();
        } catch (error) {
            ErrorHandler.handle(error, '드래그 처리');
        }
    }

    // 마우스 버튼을 뗄 때 호출되는 드래그 종료 메서드
    // 드래그 상태를 정리하고 이벤트 리스너를 제거
    onGlobalDragEnd(e) {
        if (!this.state.isDragging) return; // 드래그 중이 아니면 무시

        try {
            // 드래그 상태 초기화
            this.state.isDragging = false;
            this.state.dragMode = null;

            // 드래그 중 시각적 표시 제거
            if (this.state.selectedFurniture) {
                this.state.selectedFurniture.classList.remove('dragging');
            }

            // 전역 마우스 이벤트 리스너 제거 (메모리 누수 방지)
            // 드래그가 끝났으므로 전역 이벤트 추적 불필요
            document.removeEventListener('mousemove', this._boundOnGlobalDrag);
            document.removeEventListener('mouseup', this._boundOnGlobalDragEnd);

            // 이력 추가 (앱 인스턴스가 있는 경우)
            const app = window.roomApp;
            if (app && app.pushHistory) {
                let label = '';
                if (this.state.dragMode === 'new') {
                    // 새 가구 추가인 경우, 가구 타입 정보를 포함
                    const furnitureType = this.state.selectedFurniture?.dataset.type;
                    const furnitureLabel = app.getFurnitureTypeLabel(furnitureType);
                    label = `${furnitureLabel} 추가`;
                } else {
                    // 기존 가구 이동인 경우, 선택된 가구의 타입 정보를 포함
                    const furnitureType = this.state.selectedFurniture?.dataset.type;
                    const furnitureLabel = app.getFurnitureTypeLabel(furnitureType);
                    label = `${furnitureLabel} 이동`;
                }
                setTimeout(() => app.pushHistory(label), 100);
            }
        } catch (error) {
            ErrorHandler.handle(error, '드래그 종료');
        }
    }

    // 캔버스의 빈 공간을 클릭했을 때 가구 선택을 해제하는 메서드
    // 사용자가 빈 공간을 클릭하면 현재 선택을 해제하여 직관적인 UX 제공
    handleCanvasClick(e) {
        // 캔버스 자체나 바닥을 클릭한 경우에만 선택 해제
        // 가구나 다른 UI 요소를 클릭한 경우는 제외
        if (e.target === this.roomCanvas || e.target.classList.contains('floor')) {
            this.furnitureManager.deselectFurniture();
        }
    }
}

// 스크린샷 관리 클래스 - 현재 방 상태를 이미지로 캡처하는 기능
// html2canvas 라이브러리를 사용하여 DOM을 이미지로 변환
class ScreenshotManager {
    constructor(state, floorManager) {
        this.state = state;             // AppState 인스턴스 참조
        this.floorManager = floorManager; // FloorManager 인스턴스 참조 (바닥 스타일 처리용)
        this.roomCanvas = null;         // 캡처할 캔버스 요소
    }

    // 스크린샷 관리자 초기화
    init() {
        this.roomCanvas = document.getElementById('roomCanvas');
        if (!this.roomCanvas) {
            throw new Error('룸 캔버스 요소를 찾을 수 없습니다');
        }
    }

    // 스크린샷을 캡처하는 메인 메서드
    // 비동기 처리로 캡처 과정에서 사용자에게 진행 상황을 알려줌
    async captureScreenshot() {
        const captureBtn = document.getElementById('captureBtn');
        const originalText = captureBtn.textContent; // 원래 버튼 텍스트 저장

        try {
            // 캡처 버튼 UI 상태 변경 (사용자에게 진행 상황 표시)
            captureBtn.textContent = '캡처 중...';
            captureBtn.disabled = true; // 중복 클릭 방지
            captureBtn.classList.add('loading'); // 로딩 스타일 적용

            // html2canvas 라이브러리 사용 가능 여부 확인
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas 라이브러리를 사용할 수 없습니다');
            }

            // 캡처 전 준비 작업 (선택 표시 제거 등)
            // 스크린샷에 선택 표시가 포함되지 않도록 임시 제거
            const selectedElements = this.roomCanvas.querySelectorAll('.selected');
            selectedElements.forEach(el => el.classList.remove('selected'));

            // 캡처를 위한 특별한 준비 (바닥 스타일 강제 적용 등)
            // html2canvas가 CSS를 제대로 인식하지 못하는 경우를 대비
            await this.prepareForCapture();

            // 브라우저가 모든 스타일을 렌더링할 때까지 대기
            await this.waitForRender();

            const rect = this.roomCanvas.getBoundingClientRect();

            // html2canvas를 사용하여 캔버스를 이미지로 변환
            const canvas = await html2canvas(this.roomCanvas, {
                backgroundColor: '#ffffff',    // 배경색 (투명한 부분을 흰색으로 채움)
                scale: 2,                     // 2배 해상도로 고품질 캡처
                useCORS: true,                // CORS 이미지 허용 (외부 이미지 포함)
                allowTaint: true,             // 외부 이미지 허용
                logging: false,               // 콘솔 로그 비활성화 (성능 향상)
                width: rect.width,            // 캡처할 너비
                height: rect.height,          // 캡처할 높이
                scrollX: 0,                   // 스크롤 위치 무시
                scrollY: 0,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                onclone: (clonedDoc, element) => {
                    // 복제된 문서에서 바닥 스타일 강제 적용
                    // html2canvas가 DOM을 복제할 때 스타일이 제대로 적용되지 않는 문제 해결
                    this.forceFloorStyleInClone(clonedDoc);
                }
            });

            // 선택 표시 복구 (캡처 완료 후 원래 상태로 되돌림)
            selectedElements.forEach(el => el.classList.add('selected'));

            // 캡처된 이미지를 모달로 표시
            await this.showCaptureModal(canvas);

        } catch (error) {
            ErrorHandler.handle(error, '스크린샷 캡처');
        } finally {
            // 캡처 버튼 상태 복구 (성공/실패와 관계없이 실행)
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
            captureBtn.classList.remove('loading');
        }
    }

    // 캡처 전 준비 작업 - 바닥 요소를 다시 생성하여 렌더링 문제 해결
    // html2canvas가 CSS 클래스를 제대로 인식하지 못하는 경우를 대비하여 인라인 스타일로 강제 적용
    async prepareForCapture() {
        const floor = document.querySelector('.floor');
        if (floor) {
            // 기존 바닥 요소 제거 (캡처 시 스타일 문제 방지)
            floor.remove();

            // 새 바닥 요소 생성
            const newFloor = document.createElement('div');
            newFloor.className = 'floor';
            newFloor.dataset.floorType = this.state.floor.type;

            // 모든 스타일을 인라인으로 직접 적용 (CSS 클래스 의존성 제거)
            this.applyInlineFloorStyles(newFloor);

            // 캔버스에 새 바닥 추가
            this.roomCanvas.appendChild(newFloor);

            // 바닥 매니저의 참조 업데이트
            this.floorManager.floorElement = newFloor;
        }
    }

    // 바닥 요소에 인라인 스타일을 직접 적용하는 메서드
    // html2canvas에서 CSS 클래스가 제대로 인식되지 않는 문제를 해결
    applyInlineFloorStyles(floorElement) {
        // 기본 레이아웃 스타일들을 인라인으로 강제 적용
        const baseStyles = {
            position: 'absolute',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100%',
            height: `${CONSTANTS.FLOOR_HEIGHT}px`,
            borderRadius: '0 0 12px 12px',
            zIndex: '2',
            display: 'block !important',      // CSS와 관계없이 강제 표시
            visibility: 'visible !important',
            opacity: '1 !important',
            pointerEvents: 'none',
            boxSizing: 'border-box'
        };

        // 기본 스타일 적용
        Object.assign(floorElement.style, baseStyles);

        // 바닥 타입별 스타일 적용
        if (this.state.floor.type === 'upload' && this.state.floor.imageData) {
            // 업로드된 이미지 사용
            Object.assign(floorElement.style, {
                backgroundImage: `url('${this.state.floor.imageData}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                borderTop: '4px solid #bfa16a'
            });
        } else if (FLOOR_STYLES[this.state.floor.type]) {
            // 미리 정의된 스타일 사용
            Object.assign(floorElement.style, FLOOR_STYLES[this.state.floor.type]);
        } else {
            // 기본 스타일 사용
            Object.assign(floorElement.style, FLOOR_STYLES.default);
        }

        // 강제 리플로우 (브라우저가 스타일을 즉시 적용하도록 강제)
        // offsetHeight를 읽으면 브라우저가 강제로 레이아웃을 다시 계산
        floorElement.offsetHeight;
    }

    // html2canvas의 복제된 문서에서 바닥 스타일을 강제 적용하는 메서드
    // html2canvas는 DOM을 복제하여 캡처하는데, 이 과정에서 스타일이 누락될 수 있음
    forceFloorStyleInClone(clonedDoc) {
        const clonedFloor = clonedDoc.querySelector('.floor');
        if (!clonedFloor) return;

        // 복제된 문서의 바닥에 모든 스타일을 !important로 강제 적용
        const styles = {
            position: 'absolute !important',
            left: '0px !important',
            right: '0px !important',
            bottom: '0px !important',
            width: '100% !important',
            height: `${CONSTANTS.FLOOR_HEIGHT}px !important`,
            borderRadius: '0 0 12px 12px !important',
            zIndex: '2 !important',
            display: 'block !important',
            visibility: 'visible !important',
            opacity: '1 !important',
            pointerEvents: 'none !important',
            boxSizing: 'border-box !important'
        };

        // 기본 스타일 강제 적용 (!important로 우선순위 최고로 설정)
        Object.entries(styles).forEach(([property, value]) => {
            clonedFloor.style.setProperty(property, value, 'important');
        });

        // 바닥 타입별 스타일 적용
        if (this.state.floor.type === 'upload' && this.state.floor.imageData) {
            // 업로드 이미지 배경 스타일
            clonedFloor.style.setProperty('background-image', `url('${this.state.floor.imageData}')`, 'important');
            clonedFloor.style.setProperty('background-size', 'cover', 'important');
            clonedFloor.style.setProperty('background-position', 'center', 'important');
            clonedFloor.style.setProperty('background-repeat', 'no-repeat', 'important');
            clonedFloor.style.setProperty('border-top', '4px solid #bfa16a', 'important');
        } else {
            // 미리 정의된 바닥 스타일
            const floorStyle = FLOOR_STYLES[this.state.floor.type] || FLOOR_STYLES.default;
            Object.entries(floorStyle).forEach(([property, value]) => {
                // camelCase를 CSS kebab-case로 변환 (예: backgroundColor → background-color)
                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                clonedFloor.style.setProperty(cssProperty, value, 'important');
            });
        }

        // CSS 클래스와 데이터 속성도 추가 적용 (디버깅 및 스타일 적용 보조)
        clonedFloor.className = 'floor';
        clonedFloor.setAttribute('data-floor-type', this.state.floor.type);
    }

    // 브라우저가 모든 스타일을 완전히 렌더링할 때까지 대기하는 메서드
    // 스타일 변경 후 즉시 캡처하면 렌더링이 완료되지 않을 수 있어 대기 시간 필요
    async waitForRender() {
        // 더 긴 대기 시간과 실제 렌더링 완료 확인
        return new Promise(resolve => {
            // 먼저 requestAnimationFrame으로 다음 프레임을 기다림
            requestAnimationFrame(() => {
                // 그 다음 한 번 더 기다려서 모든 스타일 적용이 완료되도록 함
                requestAnimationFrame(() => {
                    // 마지막으로 짧은 시간 대기하여 완전한 렌더링 보장
                    setTimeout(resolve, 100);
                });
            });
        });
    }

    // 캡처된 이미지를 모달 창에 표시하는 메서드
    // 사용자가 캡처 결과를 확인하고 다운로드/복사할 수 있는 인터페이스 제공
    async showCaptureModal(canvas) {
        const captureCanvas = document.getElementById('captureCanvas');
        const ctx = captureCanvas.getContext('2d');

        // 캡처된 이미지를 모달의 캔버스에 복사
        captureCanvas.width = canvas.width;   // 원본 해상도 유지
        captureCanvas.height = canvas.height;
        // 실제 캡처된 이미지의 비율에 맞게 style.width/style.height 동기화
        captureCanvas.style.width = canvas.width + 'px';
        captureCanvas.style.height = canvas.height + 'px';

        // 캡처된 이미지를 모달 캔버스에 그리기
        ctx.drawImage(canvas, 0, 0);

        // 모달 창 표시
        const modal = document.getElementById('captureModal');
        modal.classList.remove('hidden'); // 숨김 클래스 제거로 모달 표시
        modal.focus(); // 접근성을 위한 포커스 설정 (키보드 사용자 고려)
    }

    // 캡처된 이미지를 파일로 다운로드하는 메서드
    // 브라우저의 다운로드 기능을 활용하여 이미지 저장
    downloadImage() {
        try {
            const canvas = document.getElementById('captureCanvas');
            const link = document.createElement('a'); // 다운로드용 임시 링크 생성

            // 파일명에 타임스탬프 포함 (중복 방지 및 구분)
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            link.download = `inmyroom-${timestamp}.png`;

            // 캔버스를 PNG 이미지로 변환하여 다운로드 링크 생성
            link.href = canvas.toDataURL('image/png');

            // 임시로 DOM에 추가하여 클릭 이벤트 발생 (프로그래밍적 다운로드)
            document.body.appendChild(link);
            link.click(); // 자동 클릭으로 다운로드 시작
            document.body.removeChild(link); // 사용 후 즉시 제거

            ErrorHandler.showSuccess('이미지가 다운로드되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '이미지 다운로드');
        }
    }

    // 캡처된 이미지를 클립보드에 복사하는 메서드
    // 현대적인 브라우저의 Clipboard API 사용
    async copyToClipboard() {
        try {
            const canvas = document.getElementById('captureCanvas');

            if (!canvas) {
                throw new Error('캡처된 이미지를 찾을 수 없습니다');
            }

            // 브라우저의 클립보드 API 지원 여부 확인
            if (!navigator.clipboard || !navigator.clipboard.write) {
                throw new Error('클립보드 API를 사용할 수 없습니다');
            }

            // 캔버스를 Blob 객체로 변환 (클립보드 API에서 요구하는 형식)
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

            // 클립보드에 이미지 데이터 복사
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            ErrorHandler.showSuccess('이미지가 클립보드에 복사되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '클립보드 복사');
            // 클립보드 복사가 실패하면 폴백으로 다운로드 시도
            // 일부 브라우저에서 클립보드 API가 지원되지 않을 수 있음
            this.downloadImage();
        }
    }

    // 캡처 모달 창을 닫는 메서드
    closeModal() {
        const modal = document.getElementById('captureModal');
        modal.classList.add('hidden'); // 숨김 클래스 추가로 모달 숨김
        document.body.style.overflow = ''; // 배경 스크롤 복구
    }
}

// 상태 저장/로드 관리 클래스 - 방의 현재 상태를 로컬 스토리지에 저장하고 복원
// 사용자가 페이지를 새로고침해도 작업한 내용을 잃지 않도록 하는 중요한 기능
class StateManager {
    constructor(state, floorManager, backgroundManager, furnitureManager) {
        this.state = state;                   // AppState 인스턴스 참조
        this.floorManager = floorManager;     // FloorManager 인스턴스 참조
        this.backgroundManager = backgroundManager; // BackgroundManager 인스턴스 참조
        this.furnitureManager = furnitureManager;   // FurnitureManager 인스턴스 참조
    }

    // 현재 방 상태를 로컬 스토리지에 저장하는 메서드
    // JSON 형태로 직렬화하여 브라우저 로컬 스토리지에 저장
    saveState() {
        try {
            // 모든 가구의 정보를 배열로 수집
            const furnitureData = [];
            this.state.getAllFurniture().forEach(furniture => {
                furnitureData.push({
                    type: furniture.dataset.type,                    // 가구 타입 (chair, table 등)
                    width: parseInt(furniture.style.width),         // 가구 너비
                    height: parseInt(furniture.style.height),       // 가구 높이
                    left: parseInt(furniture.style.left),           // X 좌표
                    top: parseInt(furniture.style.top),             // Y 좌표
                    zIndex: parseInt(furniture.style.zIndex),       // 레이어 순서
                    transform: furniture.style.transform || ''      // 회전 변환 (rotate 함수)
                });
            });

            // 전체 방 상태를 객체로 구성
            const roomState = {
                furniture: furnitureData,        // 가구 정보 배열
                background: this.state.background, // 배경 설정 (색상 또는 이미지)
                floor: this.state.floor,         // 바닥 설정 (스타일 또는 이미지)
                timestamp: new Date().toISOString(), // 저장 시간 (디버깅 및 버전 관리용)
                version: '2.0'                   // 데이터 버전 (향후 호환성을 위해)
            };

            // JSON 문자열로 변환하여 로컬 스토리지에 저장
            localStorage.setItem('inmyroom_state', JSON.stringify(roomState));
            console.log('방 상태 저장 완료');
            return true; // 저장 성공
        } catch (error) {
            ErrorHandler.handle(error, '상태 저장');
            return false; // 저장 실패
        }
    }

    // 로컬 스토리지에서 방 상태를 불러오는 메서드
    // 비동기 처리로 복원 과정에서 발생할 수 있는 지연 시간 고려
    async loadState() {
        try {
            // 로컬 스토리지에서 저장된 상태 가져오기
            const savedState = localStorage.getItem('inmyroom_state');
            if (!savedState) return false; // 저장된 상태가 없으면 false 반환

            // JSON 문자열을 객체로 파싱
            const roomState = JSON.parse(savedState);
            console.log('저장된 상태 로드:', roomState);

            // 기존 가구들을 모두 정리 (깨끗한 상태에서 복원 시작)
            this.clearAllFurniture();

            // 각 요소별로 상태 복원 (순서 중요: 배경 → 바닥 → 가구)
            await this.restoreBackground(roomState.background);   // 배경 복원
            await this.restoreFloor(roomState.floor);            // 바닥 복원
            await this.restoreFurniture(roomState.furniture);    // 가구 복원

            console.log('방 상태 로드 완료');
            return true; // 로드 성공
        } catch (error) {
            ErrorHandler.handle(error, '상태 로드');
            return false; // 로드 실패
        }
    }

    // 현재 배치된 모든 가구를 제거하는 메서드
    // 새로운 상태 로드나 초기화 시 사용
    clearAllFurniture() {
        this.state.getAllFurniture().forEach(furniture => {
            this.furnitureManager.deleteFurniture(furniture); // 각 가구를 안전하게 삭제
        });
        // 카운터와 z-index 초기화 (새로운 시작을 위해)
        this.state.furnitureCounter = 0;
        this.state.maxZIndex = CONSTANTS.MAX_Z_INDEX;
    }

    // 배경 설정을 복원하는 메서드
    // 색상 배경과 이미지 배경 모두 지원
    async restoreBackground(backgroundData) {
        if (!backgroundData) return; // 배경 데이터가 없으면 조기 반환

        // 상태 객체에 배경 데이터 복원 (깊은 복사로 원본 데이터 보호)
        this.state.background = { ...backgroundData };

        const canvasElement = document.getElementById('roomCanvas');
        if (!canvasElement) return; // 캔버스 요소가 없으면 조기 반환

        if (backgroundData.type === 'upload' && backgroundData.imageData) {
            // 업로드된 이미지 배경 복원
            Object.assign(canvasElement.style, {
                backgroundImage: `url('${backgroundData.imageData}')`, // Base64 이미지 데이터 적용
                backgroundSize: 'cover',     // 이미지가 전체 영역을 덮도록
                backgroundPosition: 'center', // 중앙 정렬
                backgroundRepeat: 'no-repeat' // 반복 없음
            });

            // 업로드 피드백 텍스트 표시 (사용자에게 복원된 이미지 정보 제공)
            const feedbackSpan = document.getElementById('bgImageName');
            if (feedbackSpan) {
                feedbackSpan.textContent = '업로드된 이미지 (복원됨)';
            }
        } else if (backgroundData.type && backgroundData.type.startsWith('#')) {
            // 색상 배경 복원 (16진수 색상 코드)
            canvasElement.style.backgroundColor = backgroundData.type;
        }

        // UI 드롭다운도 함께 업데이트 (사용자 인터페이스 동기화)
        const bgSelect = document.getElementById('backgroundSelect');
        if (bgSelect && backgroundData.type) {
            bgSelect.value = backgroundData.type;
        }
    }

    // 바닥 설정을 복원하는 메서드
    // 미리 정의된 스타일과 업로드된 이미지 모두 지원
    async restoreFloor(floorData) {
        if (!floorData) return; // 바닥 데이터가 없으면 조기 반환

        // 상태 객체에 바닥 데이터 복원
        this.state.floor = { ...floorData };

        if (floorData.type === 'upload' && floorData.imageData) {
            // 업로드된 바닥 이미지 피드백 표시
            const feedbackSpan = document.getElementById('floorImageName');
            if (feedbackSpan) {
                feedbackSpan.textContent = '업로드된 이미지 (복원됨)';
            }
        }

        // 바닥 스타일 적용 및 UI 업데이트
        this.floorManager.applyFloorStyle(floorData.type || 'default');
        this.floorManager.updateFloorSelect(floorData.type || 'default');
    }

    // 가구 배치를 복원하는 메서드
    // 저장된 가구 데이터 배열을 순회하며 각 가구를 재생성
    async restoreFurniture(furnitureData) {
        if (!Array.isArray(furnitureData)) return; // 가구 데이터가 배열이 아니면 조기 반환

        // 저장된 가구 데이터를 순회하며 가구 재생성
        furnitureData.forEach(data => {
            const furniture = this.furnitureManager.createFurniture(
                data.type,   // 가구 타입 (chair, table 등)
                data.width,  // 너비
                data.height, // 높이
                data.left,   // X 좌표
                data.top     // Y 좌표
            );

            if (furniture) {
                // 저장된 추가 속성들 복원
                furniture.style.zIndex = data.zIndex;      // 레이어 순서 복원
                furniture.style.transform = data.transform; // 회전 상태 복원

                // 캔버스에 가구 추가 (DOM에 실제 표시)
                document.getElementById('roomCanvas').appendChild(furniture);

                // 최대 z-index 값 업데이트 (새 가구 생성 시 올바른 레이어 순서 보장)
                this.state.maxZIndex = Math.max(this.state.maxZIndex, data.zIndex);
            }
        });
    }

    // 방을 초기 상태로 리셋하는 메서드
    // 사용자가 모든 가구를 한 번에 삭제하고 싶을 때 사용
    resetRoom() {
        if (confirm('모든 가구를 삭제하시겠습니까?')) { // 사용자 확인 (실수 방지)
            try {
                this.clearAllFurniture(); // 모든 가구 안전하게 제거
                ErrorHandler.showSuccess('방이 초기화되었습니다');
            } catch (error) {
                ErrorHandler.handle(error, '방 초기화');
            }
        }
    }
}

// 메인 애플리케이션 클래스 - 모든 매니저 클래스들을 통합하여 관리
// 전체 애플리케이션의 진입점이자 컨트롤러 역할
class InMyRoomApp {
    constructor() {
        // 각 매니저 클래스들의 인스턴스 생성 (의존성 주입 패턴)
        this.state = new AppState(); // 상태 관리 (데이터 계층)
        this.floorManager = new FloorManager(this.state); // 바닥 관리
        this.backgroundManager = new BackgroundManager(this.state); // 배경 관리
        this.furnitureManager = new FurnitureManager(this.state); // 가구 관리
        this.dragDropManager = new DragDropManager(this.state, this.furnitureManager); // 드래그 앤 드롭
        this.screenshotManager = new ScreenshotManager(this.state, this.floorManager); // 스크린샷
        this.stateManager = new StateManager(this.state, this.floorManager, this.backgroundManager, this.furnitureManager); // 상태 저장/로드
        
        // 이력 타임라인 초기화
        this.historyTimeline = [];
        this.historyPointer = -1;
        this.HISTORY_LIMIT = 10;
    }

    // 이력 타임라인 관련 메서드들
    snapshotRoomState() {
        const furnitureData = [];
        this.state.getAllFurniture().forEach(furniture => {
            furnitureData.push({
                type: furniture.dataset.type,
                width: parseInt(furniture.style.width),
                height: parseInt(furniture.style.height),
                left: parseInt(furniture.style.left),
                top: parseInt(furniture.style.top),
                zIndex: parseInt(furniture.style.zIndex),
                transform: furniture.style.transform || ''
            });
        });
        return {
            furniture: JSON.parse(JSON.stringify(furnitureData)),
            background: JSON.parse(JSON.stringify(this.state.background)),
            floor: JSON.parse(JSON.stringify(this.state.floor)),
            timestamp: new Date().toISOString()
        };
    }

    // 가구 타입을 한국어로 변환하는 메서드
    getFurnitureTypeLabel(type) {
        const labels = {
            chair: '의자',
            chair_2: '의자2',
            chair_3: '의자3',
            table: '테이블',
            bed: '침대',
            sofa: '소파',
            window: '창문',
            window_2: '창문2',
            window_3: '창문3',
            window_4: '창문4',
            door: '문',
            door_2: '문2',
            door_3: '문3',
            door_4: '문4',
            picture: '그림',
            plant: '식물',
            basil: '바질',
            lamp: '램프'
        };
        return labels[type] || type;
    }

    pushHistory(label) {
        // Remove redo states if any
        if (this.historyPointer < this.historyTimeline.length - 1) {
            this.historyTimeline = this.historyTimeline.slice(0, this.historyPointer + 1);
        }
        // Add new snapshot
        const snapshot = this.snapshotRoomState();
        snapshot.label = label || '이력';
        this.historyTimeline.push(snapshot);
        // Limit history length
        if (this.historyTimeline.length > this.HISTORY_LIMIT) {
            this.historyTimeline.shift();
        }
        this.historyPointer = this.historyTimeline.length - 1;
        this.renderHistoryTimeline();
    }

    renderHistoryTimeline() {
        const list = document.getElementById('historyList');
        if (!list) return;
        list.innerHTML = '';
        this.historyTimeline.forEach((snap, idx) => {
            const li = document.createElement('li');
            li.className = 'history-item' + (idx === this.historyPointer ? ' active' : '');
            li.tabIndex = 0;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', idx === this.historyPointer ? 'true' : 'false');
            li.textContent = (snap.label || '이력') + ' #' + (idx + 1);
            li.title = new Date(snap.timestamp).toLocaleString();
            li.addEventListener('click', () => this.restoreHistory(idx));
            li.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') this.restoreHistory(idx);
            });
            list.appendChild(li);
        });
    }

    async restoreHistory(idx) {
        if (idx < 0 || idx >= this.historyTimeline.length) return;
        const snap = this.historyTimeline[idx];
        // Use StateManager's restore logic
        await this.stateManager.clearAllFurniture();
        await this.stateManager.restoreBackground(snap.background);
        await this.stateManager.restoreFloor(snap.floor);
        await this.stateManager.restoreFurniture(snap.furniture);
        this.historyPointer = idx;
        this.renderHistoryTimeline();
    }

    // 애플리케이션 초기화 메서드 - 모든 구성 요소를 순차적으로 초기화
    async init() {
        try {
            // 각 매니저들을 순차적으로 초기화 (의존성 순서 고려)
            this.floorManager.init();        // 바닥 관리자 초기화
            this.backgroundManager.init();   // 배경 관리자 초기화
            this.furnitureManager.init();    // 가구 관리자 초기화
            this.dragDropManager.init();     // 드래그 앤 드롭 관리자 초기화
            this.screenshotManager.init();   // 스크린샷 관리자 초기화

            // UI 이벤트 리스너들 설정 (사용자 상호작용 처리)
            this.setupEventListeners();

            // 브라우저에 저장된 이전 상태 로드 시도
            const stateLoaded = await this.stateManager.loadState();

            // 저장된 상태가 없으면 기본 바닥 스타일 적용
            if (!stateLoaded) {
                this.floorManager.applyFloorStyle('default');
            }

            // 페이지를 벗어날 때 현재 상태 자동 저장 (데이터 손실 방지)
            window.addEventListener('beforeunload', () => {
                this.stateManager.saveState();
            });

            // 이력 타임라인 초기화
            this.pushHistory('초기 상태');

            console.log('InMyRoom 애플리케이션이 성공적으로 초기화되었습니다');
        } catch (error) {
            ErrorHandler.handle(error, '애플리케이션 초기화');
        }
    }

    // 모든 UI 이벤트 리스너들을 설정하는 메서드
    // 사용자가 클릭, 키보드 입력 등으로 상호작용할 수 있도록 하는 핵심 기능
    setupEventListeners() {
        // ============================================
        // 헤더 버튼들의 이벤트 리스너
        // 주요 액션 버튼들 (스크린샷, 초기화)
        // ============================================

        // 스크린샷 캡처 버튼 - 현재 방 상태를 이미지로 저장
        document.getElementById('captureBtn')?.addEventListener('click', () => {
            this.screenshotManager.captureScreenshot();
        });

        // 방 초기화 버튼 - 모든 가구를 삭제하여 빈 방으로 되돌림
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.stateManager.resetRoom();
        });

        // ============================================
        // 가구 조작 컨트롤 버튼들
        // 선택된 가구를 세밀하게 조정하는 기능들
        // ============================================

        // 가구를 앞으로 가져오기 버튼 (z-index 증가)
        document.getElementById('bringForward')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.bringForward();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 앞으로 이동`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구를 뒤로 보내기 버튼 (z-index 감소)
        document.getElementById('sendBackward')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.sendBackward();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 뒤로 이동`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 왼쪽 회전 버튼 (반시계방향)
        document.getElementById('rotateLeft')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.rotateLeft();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 회전`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 오른쪽 회전 버튼 (시계방향)
        document.getElementById('rotateRight')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.rotateRight();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 회전`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 크기 줄이기 버튼
        document.getElementById('resizeSmaller')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.resizeSmaller();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 크기 조절`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 크기 늘리기 버튼
        document.getElementById('resizeBigger')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.resizeBigger();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 크기 조절`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // ============================================
        // 가구 정렬 버튼들
        // 선택된 가구를 정렬하는 기능들
        // ============================================

        // 가구 왼쪽 정렬 버튼
        document.getElementById('alignLeft')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignLeft();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 가운데 정렬 버튼
        document.getElementById('alignCenter')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignCenter();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 오른쪽 정렬 버튼
        document.getElementById('alignRight')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignRight();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 상단 정렬 버튼
        document.getElementById('alignTop')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignTop();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 중앙 정렬 버튼
        document.getElementById('alignMiddle')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignMiddle();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 가구 하단 정렬 버튼
        document.getElementById('alignBottom')?.addEventListener('click', () => {
            if (this.state.getSelectedFurniture()) {
                this.furnitureManager.alignBottom();
                const furniture = this.state.getSelectedFurniture();
                const furnitureLabel = furniture ? this.getFurnitureTypeLabel(furniture.dataset.type) : '가구';
                this.pushHistory(`${furnitureLabel} 정렬`);
            } else {
                this.showNoSelectionMessage();
            }
        });

        // 선택된 가구 삭제 버튼 (확인 다이얼로그 포함)
        document.getElementById('deleteSelected')?.addEventListener('click', () => {
            const furniture = this.state.getSelectedFurniture();
            if (furniture && confirm('선택된 가구를 삭제하시겠습니까?')) {
                const furnitureLabel = this.getFurnitureTypeLabel(furniture.dataset.type);
                this.furnitureManager.deleteFurniture(furniture);
                this.pushHistory(`${furnitureLabel} 삭제`);
            } else if (!furniture) {
                this.showNoSelectionMessage();
            }
        });

        // ============================================
        // 배경 및 바닥 설정 이벤트 리스너
        // 방의 전체적인 분위기를 설정하는 기능들
        // ============================================

        // 배경 선택 드롭다운 - 배경색이나 이미지 업로드 선택
        document.getElementById('backgroundSelect')?.addEventListener('change', (e) => {
            this.backgroundManager.changeBackground(e.target.value);
        });

        // 바닥 선택 드롭다운 - 바닥 재질이나 이미지 업로드 선택
        document.getElementById('floorSelect')?.addEventListener('change', (e) => {
            this.floorManager.changeFloor(e.target.value);
        });

        // 배경 이미지 업로드 파일 입력 - 사용자 정의 배경 이미지
        document.getElementById('bgImageInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.backgroundManager.handleBackgroundImageUpload(file);
            }
        });

        // 바닥 이미지 업로드 파일 입력 - 사용자 정의 바닥 이미지
        document.getElementById('floorImageInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.floorManager.handleFloorImageUpload(file);
            }
        });

        // 선택된 가구의 타입 변경 드롭다운 - 같은 위치에서 다른 가구로 변경
        document.getElementById('furnitureTypeChanger')?.addEventListener('change', (e) => {
            this.furnitureManager.changeFurnitureType(e.target.value);
        });

        // ============================================
        // 스크린샷 모달 관련 이벤트 리스너
        // 캡처된 이미지를 처리하는 기능들
        // ============================================

        // 모달 닫기 버튼
        document.getElementById('closeModal')?.addEventListener('click', () => {
            this.screenshotManager.closeModal();
        });

        // 이미지 다운로드 버튼 - 캡처된 이미지를 파일로 저장
        document.getElementById('downloadImage')?.addEventListener('click', () => {
            this.screenshotManager.downloadImage();
        });

        // 클립보드에 복사 버튼 - 캡처된 이미지를 클립보드로 복사
        document.getElementById('copyToClipboard')?.addEventListener('click', () => {
            this.screenshotManager.copyToClipboard();
        });

        // ============================================
        // 추가 UI 기능들
        // 사용자 경험을 향상시키는 부가 기능들
        // ============================================

        // 사이드바 카테고리 토글 기능 설정 (가구 목록 접기/펼치기)
        this.setupCategoryToggles();

        // 키보드 단축키 설정 (키보드만으로도 조작 가능)
        this.setupKeyboardShortcuts();

        // 모달 관련 추가 컨트롤 (ESC 키, 외부 클릭으로 닫기)
        this.setupModalControls();
    }

    // 사이드바의 카테고리 접기/펼치기 기능을 설정하는 메서드
    // 가구 목록이 많을 때 원하는 카테고리만 표시하여 UI를 깔끔하게 유지
    setupCategoryToggles() {
        const categoryHeaders = document.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            // 마우스 클릭 시 토글
            header.addEventListener('click', () => this.toggleCategory(header));
            // 키보드 접근성 (Enter, Space 키로도 토글 가능)
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // 기본 동작 방지 (스크롤 등)
                    this.toggleCategory(header);
                }
            });
        });
    }

    // 특정 카테고리를 접거나 펼치는 메서드
    // CSS 클래스 조작을 통해 애니메이션과 함께 부드럽게 전환
    toggleCategory(header) {
        const category = header.dataset.category;                    // 카테고리 식별자
        const content = document.getElementById(`${category}-content`); // 카테고리 내용 요소
        const isCollapsed = header.classList.contains('collapsed');  // 현재 접힘 상태 확인

        if (isCollapsed) {
            // 접혀있으면 펼치기
            header.classList.remove('collapsed');
            content.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true'); // 접근성 속성 업데이트 (스크린 리더용)
        } else {
            // 펼쳐있으면 접기
            header.classList.add('collapsed');
            content.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
        }
    }

    // 키보드 단축키 기능을 설정하는 메서드
    // 마우스 없이도 효율적으로 가구를 조작할 수 있도록 하는 접근성 기능
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const furniture = this.state.getSelectedFurniture();
            if (!furniture) return; // 선택된 가구가 없으면 단축키 무시

            // Delete 또는 Backspace 키로 가구 삭제
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault(); // 기본 동작 방지 (페이지 뒤로가기 등)
                const furniture = this.state.getSelectedFurniture();
                if (furniture && confirm('선택된 가구를 삭제하시겠습니까?')) {
                    const furnitureLabel = this.getFurnitureTypeLabel(furniture.dataset.type);
                    this.furnitureManager.deleteFurniture(furniture);
                    this.pushHistory(`${furnitureLabel} 삭제`);
                } else if (!furniture) {
                    this.showNoSelectionMessage();
                }
            }

            // 화살표 키로 가구 이동 (정밀한 위치 조정)
            if (e.key.startsWith('Arrow')) {
                e.preventDefault(); // 기본 스크롤 동작 방지
                const furniture = this.state.getSelectedFurniture();
                if (!furniture) {
                    this.showNoSelectionMessage();
                    return; // 선택된 가구가 없으면 무시
                }

                // Shift 키를 누르고 있으면 빠른 이동, 아니면 정밀 이동
                const step = e.shiftKey ? CONSTANTS.FAST_MOVEMENT_STEP : CONSTANTS.MOVEMENT_STEP;

                switch (e.key) {
                    case 'ArrowLeft':
                        this.furnitureManager.moveFurniture(-step, 0); // 왼쪽 이동
                        break;
                    case 'ArrowRight':
                        this.furnitureManager.moveFurniture(step, 0);  // 오른쪽 이동
                        break;
                    case 'ArrowUp':
                        this.furnitureManager.moveFurniture(0, -step); // 위쪽 이동
                        break;
                    case 'ArrowDown':
                        this.furnitureManager.moveFurniture(0, step);  // 아래쪽 이동
                        break;
                }
                // 이동 후 이력 추가
                setTimeout(() => {
                    const furnitureLabel = this.getFurnitureTypeLabel(furniture.dataset.type);
                    this.pushHistory(`${furnitureLabel} 이동`);
                }, 100);
            }
        });
    }

    // 모달 창의 추가 컨트롤을 설정하는 메서드
    // 사용자가 직관적으로 모달을 닫을 수 있는 다양한 방법 제공
    setupModalControls() {
        // ESC 키로 모달 닫기 (일반적인 UI 패턴)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('captureModal');
                // 모달이 열려있을 때만 닫기
                if (modal && !modal.classList.contains('hidden')) {
                    this.screenshotManager.closeModal();
                }
            }
        }
        );

        // 모달 배경 클릭 시 모달 닫기 (일반적인 UI 패턴)
        document.getElementById('captureModal')?.addEventListener('click', (e) => {
            // 모달 배경을 직접 클릭한 경우만 (내용 영역 클릭은 제외)
            if (e.target.id === 'captureModal') {
                this.screenshotManager.closeModal();
            }
        });
    }
}

// ============================================
// 애플리케이션 시작점
// DOM이 완전히 로드된 후 애플리케이션을 초기화하고 시작
// ============================================

// DOM이 완전히 로드된 후 애플리케이션 시작
// DOMContentLoaded 이벤트를 사용하여 모든 HTML 요소가 준비된 후 실행
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 메인 애플리케이션 인스턴스 생성
        const app = new InMyRoomApp();
        // 애플리케이션 초기화 (비동기 처리로 로딩 시간 고려)
        await app.init();

        // 디버깅을 위해 전역 객체에 앱 참조 저장
        // 개발자 도구에서 window.roomApp으로 접근 가능
        window.roomApp = app;

        // 애플리케이션 준비 완료 후 사용자에게 도움말 표시
        // 1초 후에 표시하여 초기화 완료 후 안내
        setTimeout(() => {
            console.log('🏠 InMyRoom 준비완료!');
            console.log('📋 키보드 단축키:');
            console.log('   • Delete/Backspace: 선택된 가구 삭제');
            console.log('   • 화살표 키: 가구 이동 (Shift + 화살표: 빠른 이동)');
            console.log('   • ESC: 모달 닫기');
        }, 1000);
    } catch (error) {
        // 초기화 실패 시 오류 처리 및 사용자 안내
        ErrorHandler.handle(error, '애플리케이션 시작');
        alert('애플리케이션을 시작할 수 없습니다. 페이지를 새로고침해주세요.');
    }
});