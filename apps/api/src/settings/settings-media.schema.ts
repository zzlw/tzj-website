import { z } from "zod";

const watermarkFolderSchema = z.enum(["uploads", "cms"]);

export const siteMediaSettingsSchema = z
  .object({
    watermark: z.object({
      enabled: z.boolean(),
      layout: z.enum(["corner", "tile", "center"]).default("corner"),
      mode: z.enum(["text", "image"]),
      text: z.string().max(64),
      imageKey: z.string().max(500).optional(),
      opacity: z.number().min(0.05).max(1),
      position: z.enum([
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "center",
      ]),
      scale: z.number().min(0.05).max(0.5),
      tileSpacing: z.number().min(1).max(2.5).default(1.5),
      tileAngle: z.number().min(-45).max(-10).default(-25),
      minWidth: z.number().int().min(0).max(10000),
      minHeight: z.number().int().min(0).max(10000),
      applyToImages: z.boolean(),
      applyToVideos: z.boolean(),
      applyToFolders: z.array(watermarkFolderSchema).min(1).max(2),
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.watermark.enabled) return;
    if (value.watermark.mode === "text" && !value.watermark.text.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "启用文字水印时请填写水印文字",
        path: ["watermark", "text"],
      });
    }
    if (value.watermark.mode === "image" && !value.watermark.imageKey?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "启用 Logo 水印时请选择水印图片",
        path: ["watermark", "imageKey"],
      });
    }
  });

export type SiteMediaSettingsInput = z.infer<typeof siteMediaSettingsSchema>;
