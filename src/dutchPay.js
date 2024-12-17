import * as yaml from "js-yaml";

const keyDonation = "찬조금";
const keyUsers = "참가자";
const keySpendings = "사용내역";
const subKeyNote = "왜";
const subKeyAmount = "얼마";
const subKeyPayer = "지불";
const subKeyUsers = "사용";
const keySum = "합산";
const keyDebug = "디버깅";
const helpMessage = `
금액이 음수(-)인 사람에게 입금을 하십시오.


계산 알고리즘 설명:
  사용내역의 각 항목에 속한 지불인들의 계좌에 지불금액을 균등하게 차감한 뒤,
  사용자들의 계좌에 사용금액을 균등하게 더한다.
  이에 금액이 양수(+)인 사람은 지불해야 함을 나타낸다.
  금액이 음수(-)인 사람은 수금해야 함을 나타낸다.
  이 표시된 금액을 모두 합산하면 0이 되어야 올바르게 계산된 것 이다.

  다만, 위 알고리즘은 기본적으로 절상(revaluation)을 기본으로 하기에 약간의 오차가 존재한다.
`;

class DutchPay {
  constructor() {
    this._donation = 0;
    this._spendings = [];
    this._users = {};
  }

  get donation() {
    return this._donation;
  }

  set donation(v) {
    this._donation = v;
  }

  get spendings() {
    return this._spendings;
  }

  get users() {
    return this._users;
  }

  generateResultText(result, isDebugMode) {
    var formatter = new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    });

    let retString = `사용내역 총액: ${formatter.format(result.totalAmount)}\n`;
    retString += `      선수금: ${formatter.format(result.totalPrepaid)}\n`;
    retString += `      미수금: ${formatter.format(
      result.totalAmount - result.totalPrepaid
    )}\n`;

    retString += `      찬조금: ${formatter.format(this.donation)}\n`;
    retString += "=======================\n";

    let sum = 0,
      sumNoCeiling = 0;
    Object.entries(result.charge).forEach(([k, v]) => {
      sumNoCeiling += v;
      v = Math.ceil(v / 100) * 100;
      sum += v;
      retString += `${k}: ${formatter.format(v)}\n`;
    });

    if (isDebugMode) {
      retString += "=======================\n";
      retString += `합산(절상)\t: ${formatter.format(sum)}\n`;
      retString += `합산\t\t\t: ${formatter.format(sumNoCeiling)}\n`;
    }

    retString += "=======================\n";
    retString += helpMessage;
    return retString;
  }

  parse(str) {
    const parsed = yaml.load(str);
    this.donation = parsed[keyDonation] ? parsed[keyDonation] : 0;
    Object.entries(parsed[keyUsers]).forEach(([k, v]) => {
      this.addUser(k, v);
    });

    parsed[keySpendings].forEach((spending) => {
      this.addSpending(
        spending[subKeyNote],
        Date.now(),
        spending[subKeyAmount],
        spending[subKeyPayer],
        spending[subKeyUsers]
      );
    });

    const isDebugMode = parsed[keySum] !== undefined;
    const result = this.makeResult(isDebugMode);
    if (parsed[keyDebug] !== undefined) {
      console.log(result);
    }

    return generateResultText(result, isDebugMode);
  }

  addUser(name, prepaid) {
    this.users[name] = {
      prepaid,
    };
  }

  addSpending(note, when, amount, payers, users) {
    payers = payers ? payers : [];
    users = users ? users : [];
    this.spendings.push({
      note,
      when,
      amount,
      payers,
      users,
    });
  }

  makeResult(isDebug) {
    const result = {
      totalAmount: 0,
      totalPrepaid: 0,
    };
    const accounts = {};
    const donationPerUser = this.donation / Object.keys(this.users).length;
    for (const name in this.users) {
      if (this.users.hasOwnProperty(name)) {
        // 선수금 + 찬조금 적용
        accounts[name] = -this.users[name].prepaid - donationPerUser;
        result.totalPrepaid += this.users[name].prepaid;
      }
    }

    this.spendings.forEach((spending) => {
      result.totalAmount += spending.amount;
      const paidAmount = spending.amount / spending.payers.length;
      const unpaidAmount = spending.amount / spending.users.length;
      if (isDebug) {
        console.log(
          "note: %s, paid: %f(%d), unpaid: %f(%d)",
          spending.note,
          paidAmount,
          spending.payers.length,
          unpaidAmount,
          spending.users.length
        );
      }
      spending.payers.forEach((payer) => {
        // 지불 내역 적용
        accounts[payer] -= paidAmount;
      });

      spending.users.forEach((user) => {
        // 사용 내역 적용
        accounts[user] += unpaidAmount;
      });
    });

    result["charge"] = accounts;
    return result;
  }
}

export default DutchPay;
