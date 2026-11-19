/**
 * ABDM's consent wording for creating an ABHA from Aadhaar. It is shown word
 * for word and never translated by machine: an approved translation, when the
 * facility has one, is loaded as supplied.
 *
 * Source: ABDM Developer Portal, catalogue 2026.09.16 (the abdm-m1 skill's
 * create-abha-aadhaar-otp guide). Re-check it against the approved consent
 * language before functional testing.
 */

/** The terms and conditions for ABHA enrolment, agreed with one "I agree". */
export const ABHA_TERMS_AND_CONDITIONS =
  'I, hereby declare that I am voluntarily sharing my Aadhaar number and demographic information issued by UIDAI, with National Health Authority (NHA) for the sole purpose of creation of ABHA number. I understand that my ABHA number can be used and shared for purposes as may be notified by ABDM from time to time including provision of healthcare services. Further, I am aware that my personal identifiable information (Name, Address, Age, Date of Birth, Gender and Photograph) may be made available to the entities working in the National Digital Health Ecosystem (NDHE) which inter alia includes stakeholders and entities such as healthcare professionals (e.g. doctors), facilities (e.g. hospitals, laboratories) and data fiduciaries (e.g. health programmes), which are registered with or linked to the Ayushman Bharat Digital Mission (ABDM), and various processes there under. I authorize NHA to use my Aadhaar number for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication. I have been duly informed about the option of using other IDs apart from Aadhaar; however, I consciously choose to use Aadhaar number for the purpose of availing benefits across the NDHE. I am aware that my personal identifiable information excluding Aadhaar number / VID number can be used and shared for purposes as mentioned above. I reserve the right to revoke the given consent at any point of time as per provisions of Aadhaar Act and Regulations.';

export const ABHA_DECLARATION_INTRO = 'I hereby declare that:';

/**
 * The five declarations of the consent language, each with its own checkbox.
 * A private entity shows them without the word "government". The second one,
 * creation with a document other than Aadhaar, stays unchecked in this flow.
 */
export const ABHA_DECLARATIONS = [
  {
    key: 'aadhaarSharing',
    text: 'I am voluntarily sharing my Aadhaar Number / Virtual ID issued by the Unique Identification Authority of India (“UIDAI”), and my demographic information for the purpose of creating an Ayushman Bharat Health Account number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”). I authorize NHA to use my Aadhaar number / Virtual ID for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication.',
  },
  {
    key: 'otherDocument',
    text: 'I intend to create Ayushman Bharat Health Account Number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”) using document other than Aadhaar. (Click here to proceed further)',
  },
  {
    key: 'recordsLinking',
    text: 'I consent to usage of my ABHA address and ABHA number for linking of my legacy (past) health records and those which will be generated during this encounter.',
  },
  {
    key: 'recordsSharing',
    text: 'I authorize the sharing of all my health records with healthcare provider(s) for the purpose of providing healthcare services to me during this encounter.',
  },
  {
    key: 'anonymizedUse',
    text: 'I consent to the anonymization and subsequent use of my health records for public health purposes.',
  },
] as const;

export type AbhaDeclarationKey = (typeof ABHA_DECLARATIONS)[number]['key'];

/** The healthcare worker's confirmation, with the signed-in user's name filled in. */
export function abhaWorkerConfirmation(workerName: string): string {
  return `I, ${workerName}, confirm that I have duly informed and explained the beneficiary of the contents of consent for aforementioned purposes.`;
}

/** The beneficiary's confirmation, with the patient's name from the screen filled in. */
export function abhaBeneficiaryConfirmation(beneficiaryName: string): string {
  return `I, ${beneficiaryName}, have been explained about the consent as stated above and hereby provide my consent for the aforementioned purposes.`;
}
