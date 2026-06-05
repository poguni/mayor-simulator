/**
 * 내가 만약 시장이라면 - Google Sheets & Apps Script 연동 스크립트 (최종 안정화 버전)
 * 
 * [동작 설명]
 * 1. doPost(e): 학생이 시뮬레이션을 완료하고 제출하면 POST 요청을 받아 구글 시트에 행을 추가합니다.
 * 2. doGet(e): 교사 대시보드가 로드될 때 GET 요청을 받아 스프레드시트의 모든 행 데이터를 JSON 배열로 반환합니다.
 */

// [중요] 스프레드시트 ID 설정 (선택사항)
// 스프레드시트 인터넷 주소창의 docs.google.com/spreadsheets/d/[이부분의_긴_문자열]/edit 에서 ID를 복사해 넣으세요.
// 비워둘 경우([확장 프로그램] -> [Apps Script]로 진입했을 때) 자동으로 현재 스프레드시트를 인식합니다.
const SPREADSHEET_ID = "1wyIuNa9bAwBXsyqm9DGNK0B254SXhEEa0iD2cmb1X08";

function getTargetSheet() {
  var ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID_HERE" && SPREADSHEET_ID.trim() !== "") {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("스프레드시트를 찾을 수 없습니다. SPREADSHEET_ID를 확인하거나 스프레드시트 내부의 확장 프로그램 메뉴를 사용해 주세요.");
  }
  
  // 첫 번째 시트를 안전하게 강제 획득
  return ss.getSheets()[0];
}

function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var lastRow = sheet.getLastRow();
    
    // 데이터가 없거나 헤더만 있는 경우 빈 배열 반환
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    var data = [];
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        var headerName = headers[j];
        record[headerName] = row[j];
      }
      data.push(record);
    }
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var sheet = getTargetSheet();
    var postData;
    
    // 요청 데이터 파싱
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      throw new Error("No data received");
    }
    
    // [삭제 액션 분기 처리]
    if (postData.action === "delete") {
      var targetTimestamp = postData.timestamp;
      if (!targetTimestamp) {
        throw new Error("Missing timestamp for deletion");
      }
      
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0];
      var timestampColIndex = headers.indexOf("timestamp");
      
      if (timestampColIndex === -1) {
        throw new Error("Timestamp column not found in sheet");
      }
      
      var deleted = false;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][timestampColIndex] === targetTimestamp) {
          sheet.deleteRow(i + 1); // 1-based index
          deleted = true;
          break;
        }
      }
      
      if (!deleted) {
        throw new Error("No matching record found to delete");
      }
      
      var result = { status: "success", message: "Record deleted successfully" };
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // [기존 저장 액션 처리]
    // 시트가 아예 비어있으면 초기 헤더 행 생성
    if (sheet.getLastRow() === 0) {
      var initialHeaders = [
        "timestamp", "mayorName", "cityType", "cityName", 
        "finalBudget", "finalPopulation", "finalHappiness", 
        "mayorTitle", "stars", "popScore", "happyScore", "budgetScore", 
        "compliment", "essayQ1", "essayQ2", "essayQ3", 
        "decisionsJson", "historyJson"
      ];
      sheet.appendRow(initialHeaders);
    }
    
    // 현재 헤더 정보 읽기
    var headers = sheet.getDataRange().getValues()[0];
    var newRow = [];
    
    // 헤더 순서에 맞추어 데이터 삽입
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (header === "timestamp") {
        newRow.push(new Date().toISOString()); // 제출 일시 기록
      } else {
        newRow.push(postData[header] !== undefined ? postData[header] : "");
      }
    }
    
    sheet.appendRow(newRow);
    
    // CORS 대응을 위해 JSON 성공 응답 리턴
    var result = { status: "success", message: "Student data saved successfully" };
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    var errResult = { status: "error", message: error.toString() };
    return ContentService.createTextOutput(JSON.stringify(errResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
