import { __ } from "@/translation";

export const getRepetitionText = (repetition: any) => {
  if (repetition.all) return __("Every week");

  const ordinals: string[] = [];
  if (repetition.first) ordinals.push(__("first"));
  if (repetition.second) ordinals.push(__("second"));
  if (repetition.third) ordinals.push(__("third"));
  if (repetition.fourth) ordinals.push(__("fourth"));
  if (repetition.fifth) ordinals.push(__("fifth"));

  if (ordinals.length === 0) return "";

  let list = ordinals[0];
  if (ordinals.length > 1) {
    const last = ordinals[ordinals.length - 1];
    const head = ordinals.slice(0, -1).join(", ");
    list = __("{0} and {1}", [head, last]);
  }

  return __("Every {0} week", [list]);
};
