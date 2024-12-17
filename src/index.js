import DutchPay from "./dutchPay.js";
import html2canvas from "html2canvas";

// DutchPay 인스턴스 생성
const dutchPay = new DutchPay();

// DOM 요소 참조
const donationInput = document.getElementById("donation-input");
const usersTableBody = document
  .getElementById("users-table")
  .querySelector("tbody");
const spendingsTableBody = document
  .getElementById("spendings-table")
  .querySelector("tbody");
const resultsTableBody = document
  .getElementById("results-table")
  .querySelector("tbody");
const resultSummary = document.getElementById("result-summary");
const resultsTables = document.getElementById("results-tables");

const addUserButton = document.getElementById("add-user-button");
const userNameInput = document.getElementById("user-name-input");
const userPrepaidInput = document.getElementById("user-prepaid-input");

const addSpendingButton = document.getElementById("add-spending-button");
const spendingNoteInput = document.getElementById("spending-note-input");
const spendingAmountInput = document.getElementById("spending-amount-input");
const payersCheckboxes = document.getElementById("payers-checkboxes");
const usersCheckboxes = document.getElementById("users-checkboxes");

const calculateButton = document.getElementById("calculate-button");
const downloadButton = document.getElementById("download-button");
const copyButton = document.getElementById("copy-button");

// 참가자 추가
addUserButton.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const prepaid = Number(userPrepaidInput.value);

  if (name) {
    dutchPay.addUser(name, prepaid);
    updateUsersTable();
    updateCheckboxes();
    clearUserInputs();
  } else {
    alert("이름을 입력해 주세요.");
  }
});

// 사용 내역 추가
addSpendingButton.addEventListener("click", () => {
  const note = spendingNoteInput.value.trim();
  const amount = Number(spendingAmountInput.value);
  const payers = getSelectedCheckboxes("payers-checkboxes");
  const users = getSelectedCheckboxes("users-checkboxes");

  if (note && amount > 0 && payers.length > 0 && users.length > 0) {
    dutchPay.addSpending(note, Date.now(), amount, payers, users);
    updateSpendingsTable();
    clearSpendingInputs();
  } else {
    alert("모든 필드를 채우고 선택해 주세요.");
  }
});

// 계산하기 버튼 클릭
calculateButton.addEventListener("click", () => {
  const donation = Number(donationInput.value);
  dutchPay.donation = donation;

  const result = dutchPay.makeResult();
  updateResultsTable(result.charge, result);
});

// 결과 다운로드 버튼 클릭
downloadButton.addEventListener("click", () => {
  html2canvas(resultsTables).then((canvas) => {
    const link = document.createElement("a");
    link.download = "result.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
});

// 결과 복사 버튼 클릭
copyButton.addEventListener("click", () => {
  const resultText = generateResultText();
  navigator.clipboard
    .writeText(resultText)
    .then(() => alert("결과가 클립보드에 복사되었습니다."))
    .catch(() => alert("복사에 실패했습니다."));
});

// 사용자 테이블 업데이트
function updateUsersTable() {
  usersTableBody.innerHTML = "";
  Object.entries(dutchPay._users).forEach(([name, { prepaid }]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${name}</td>
      <td>${prepaid}</td>
      <td><button class="remove-user-btn">삭제</button></td>
    `;
    usersTableBody.appendChild(row);

    row.querySelector(".remove-user-btn").addEventListener("click", () => {
      removeUser(name);
    });
  });

  updateCheckboxes();
}

// 사용 내역 테이블 업데이트
function updateSpendingsTable() {
  spendingsTableBody.innerHTML = "";
  dutchPay._spendings.forEach((spending, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${spending.note}</td>
      <td>${spending.amount}</td>
      <td>${spending.payers.join(", ")}</td>
      <td>${spending.users.join(", ")}</td>
      <td><button class="remove-spending-btn">삭제</button></td>
    `;
    spendingsTableBody.appendChild(row);

    row.querySelector(".remove-spending-btn").addEventListener("click", () => {
      removeSpending(index);
    });
  });
}

// 결과 테이블 업데이트
function updateResultsTable(results, summary) {
  resultsTableBody.innerHTML = "";
  const formatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  });

  Object.entries(results).forEach(([name, amount]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${name}</td>
      <td class="${amount < 0 ? "negative" : "positive"}">
        ${formatter.format(Math.abs(Math.ceil(amount / 100) * 100))}
      </td>
    `;
    resultsTableBody.appendChild(row);
  });

  const unpaidAmount = summary.totalAmount - summary.totalPrepaid;
  // 요약 정보 출력 (테이블 형태)
  resultSummary.innerHTML = `
    <table>
      <tr><th>총액</th><td class="${
        summary.totalAmount < 0 ? "negative" : "positive"
      }">${formatter.format(summary.totalAmount)}</td></tr>
      <tr><th>선수금</th><td class="${
        summary.totalPrepaid < 0 ? "negative" : "positive"
      }">${formatter.format(summary.totalPrepaid)}</td></tr>
      <tr><th>미수금</th><td class="${
        unpaidAmount < 0 ? "negative" : "positive"
      }">${formatter.format(
    Math.abs(summary.totalAmount - summary.totalPrepaid)
  )}</td></tr>
      <tr><th>찬조금</th><td class="${
        dutchPay.donation < 0 ? "negative" : "positive"
      }">${formatter.format(dutchPay.donation)}</td></tr>
    </table>
  `;
}

// 결과 텍스트 생성
function generateResultText() {
  const result = dutchPay.makeResult();
  return dutchPay.generateResultText(result, true);
}

// 사용자 삭제
function removeUser(name) {
  delete dutchPay._users[name];
  updateUsersTable();
}

// 사용 내역 삭제
function removeSpending(index) {
  dutchPay._spendings.splice(index, 1);
  updateSpendingsTable();
}

// 체크박스 업데이트
function updateCheckboxes() {
  payersCheckboxes.innerHTML = "";
  usersCheckboxes.innerHTML = "";

  Object.keys(dutchPay._users).forEach((name) => {
    payersCheckboxes.appendChild(createCheckbox(name, "payers"));
    usersCheckboxes.appendChild(createCheckbox(name, "users"));
  });
}

// 체크박스 생성
function createCheckbox(name, group) {
  const div = document.createElement("div");
  div.className = "checkbox-item";
  div.innerHTML = `
    <input type="checkbox" id="${group}-${name}" value="${name}" />
    <label for="${group}-${name}">${name}</label>
  `;
  return div;
}

// 체크박스 선택된 값 가져오기
function getSelectedCheckboxes(containerId) {
  return Array.from(
    document
      .getElementById(containerId)
      .querySelectorAll("input[type='checkbox']:checked")
  ).map((cb) => cb.value);
}

// 입력 필드 초기화
function clearUserInputs() {
  userNameInput.value = "";
  userPrepaidInput.value = "0";
}

function clearSpendingInputs() {
  spendingNoteInput.value = "";
  spendingAmountInput.value = "";
  Array.from(document.querySelectorAll("input[type='checkbox']")).forEach(
    (cb) => (cb.checked = false)
  );
}
