import activitySvg from "vadivam/strings/activity";
import spriteUrl from "vadivam/sprite.svg";
import "vadivam/font/vadivam.css";

const stringHost = document.querySelector("#string-host");
stringHost.innerHTML = activitySvg;
stringHost.querySelector("svg").id = "string";
document
  .querySelector("#sprite-use")
  .setAttribute("href", `${spriteUrl}#vadivam-activity`);
