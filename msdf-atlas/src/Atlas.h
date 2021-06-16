#pragma once

#define LCG_MULTIPLIER 6364136223846793005ull
#define DEFAULT_ANGLE_THRESHOLD 3.0

#include <iostream>
#include <msdf-atlas-gen.h>
#include <nan.h>
#include <string>
#include <vector>

#include "FontHolder.h"

#define DEFAULT_ATLAS_WIDTH 32
#define DEFAULT_ATLAS_HEIGHT 32

class Atlas : public Nan::ObjectWrap {
public:
  static NAN_MODULE_INIT(Init) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
    tpl->SetClassName(Nan::New("Atlas").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    // TODO(smolck): Why not Nan::SetMethod?
    Nan::SetPrototypeMethod(tpl, "loadFont", loadFont);
    Nan::SetPrototypeMethod(tpl, "addToCharset", addToCharset);
    Nan::SetPrototypeMethod(tpl, "loadCharsetGlyphs", loadCharsetGlyphs);
    Nan::SetPrototypeMethod(tpl, "packAndColorEdges", packAndColorEdges);
    Nan::SetPrototypeMethod(tpl, "gen", gen);
    Nan::SetPrototypeMethod(tpl, "getInfo", getInfo);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
    Nan::Set(target, Nan::New("Atlas").ToLocalChecked(),
             Nan::GetFunction(tpl).ToLocalChecked());
  }

private:
  int m_width;
  int m_height;
  FontHolder *m_fontHolder;
  std::set<uint32_t> m_charset;
  std::set<uint32_t> m_loadedCharset;
  std::vector<msdf_atlas::GlyphGeometry> m_glyphs;
  std::vector<msdf_atlas::FontGeometry> m_fonts;

  static msdfgen::BitmapConstRef<float, 3>
  makeAtlas(const std::vector<msdf_atlas::GlyphGeometry> &glyphs,
            const std::vector<msdf_atlas::FontGeometry> &fonts, int width,
            int height) {
    msdf_atlas::ImmediateAtlasGenerator<
        float, 3, msdf_atlas::msdfGenerator,
        msdf_atlas::BitmapAtlasStorage<float, 3>>
        generator(width, height);
    generator.setThreadCount(1);
    generator.generate(glyphs.data(), glyphs.size());
    auto bitmap = (msdfgen::BitmapConstRef<float, 3>)generator.atlasStorage();

    // bool success = true;

    return bitmap;
  }

  static inline Nan::Persistent<v8::Function> &constructor() {
    static Nan::Persistent<v8::Function> my_constructor;
    return my_constructor;
  }
  // static Nan::Persistent<v8::Function> constructor;

  explicit Atlas(int width = 0, int height = 0)
      : m_width(width), m_height(height), m_charset({}), m_loadedCharset({}),
        m_glyphs({}), m_fonts({}) {
    auto fontHolder = new FontHolder();
    m_fontHolder = fontHolder;
  }
  ~Atlas() { delete m_fontHolder; }

  static NAN_METHOD(New) {
    if (info.IsConstructCall()) { // Invoked as constructor: `new Atlas(...)`
      double width = info[0]->IsUndefined() ? DEFAULT_ATLAS_WIDTH
                                            : Nan::To<int>(info[0]).FromJust();
      double height = info[1]->IsUndefined() ? DEFAULT_ATLAS_HEIGHT
                                             : Nan::To<int>(info[1]).FromJust();

      Atlas *atlas = new Atlas(width, height);
      atlas->Wrap(info.This());
      info.GetReturnValue().Set(info.This());
    } else { // Invoked as plain function `Atlas(...)`, turn into construct
             // call.
      const int argc = 1;
      v8::Local<v8::Value> argv[argc] = {info[0]};
      v8::Local<v8::Function> cons = Nan::New(constructor());
      info.GetReturnValue().Set(
          Nan::NewInstance(cons, argc, argv).ToLocalChecked());
    }
  }

  static NAN_METHOD(loadFont) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());
    auto maybeStr = Nan::To<v8::String>(info[0]);
    Nan::Utf8String str(maybeStr.ToLocalChecked());

    std::cout << "Trying to load font: " << *str << "\n";
    if (!atlas->m_fontHolder->load(*str)) {
      std::cout << "Unable to load font!\n";
    } else {
      std::cout << "Loaded font!\n";
    }
  }

  static NAN_METHOD(addToCharset) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());
    auto arr = v8::Local<v8::Array>::Cast(info[0]);
    for (auto i = 0; i < arr->Length(); i++) {
      auto whyIsThisAThing = Nan::Get(arr, i).ToLocalChecked();
      auto charToAdd = Nan::To<uint32_t>(whyIsThisAThing).ToChecked();
      if (atlas->m_loadedCharset.find(charToAdd) ==
          atlas->m_loadedCharset.end()) {
        atlas->m_charset.insert(charToAdd);
      }
    }

    std::cout << "New charset: [";
    for (const auto &c : atlas->m_charset) {
      std::cout << c << ", ";
    }
    std::cout << "]\n";
  }

  // TODO(smolck): Name
  static NAN_METHOD(loadCharsetGlyphs) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());

    msdf_atlas::FontGeometry fontGeometry(&atlas->m_glyphs);
    int charsLoaded = fontGeometry.loadCharset(*atlas->m_fontHolder, 1,
                                               atlas->m_charset, true, true);
    if (charsLoaded < 0)
      std::cout << "Glyphs not loaded, sadness!" << std::endl;

    // TODO(smolck): Make this returned as, idk, { numLoaded: charsLoaded,
    // totalNum: charset.size } or something
    std::cout << "Loaded geometry of " << charsLoaded << " out of "
              << (int)atlas->m_charset.size() << " glyphs" << std::endl;

    atlas->m_fonts.push_back((msdf_atlas::FontGeometry &&) fontGeometry);
    for (const auto &c : atlas->m_charset) {
      atlas->m_loadedCharset.insert(c);
    }
    atlas->m_charset = {};
  }

  static NAN_METHOD(packAndColorEdges) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());

    double unitRange = 0, pxRange = 0;
    msdf_atlas::TightAtlasPacker atlasPacker;
    atlasPacker.setDimensionsConstraint(
        msdf_atlas::TightAtlasPacker::DimensionsConstraint::POWER_OF_TWO_SQUARE);
    atlasPacker.setScale(32);
    atlasPacker.setPadding(0);
    atlasPacker.setPixelRange(2);
    // atlasPacker.setUnitRange();
    atlasPacker.setMiterLimit(1);
    if (int remaining =
            atlasPacker.pack(atlas->m_glyphs.data(), atlas->m_glyphs.size())) {
      if (remaining < 0) {
        printf("Failed to pack glyphs into atlas.");
      } else {
        printf("Error: Could not fit %d out of %d glyphs into the atlas.\n",
               remaining, (int)atlas->m_glyphs.size());
      }
    }
    int width, height;
    atlasPacker.getDimensions(width, height);

    // TODO(smolck)
    atlas->m_width = width;
    atlas->m_height = height;

    // TODO(smolck): Return dims
    std::cout << width << " " << height << std::endl;

    unsigned long long glyphSeed = 0;

    for (msdf_atlas::GlyphGeometry &glyph : atlas->m_glyphs) {
      glyphSeed *= LCG_MULTIPLIER;
      glyph.edgeColoring(msdfgen::edgeColoringInkTrap, DEFAULT_ANGLE_THRESHOLD,
                         glyphSeed);
    }
  }

  static NAN_METHOD(gen) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());
    auto maybeWriteToFileBool = Nan::To<bool>(info[0]);
    auto writeToFile = maybeWriteToFileBool.IsJust()
                           ? maybeWriteToFileBool.ToChecked()
                           : false;

    auto bitmap = Atlas::makeAtlas(atlas->m_glyphs, atlas->m_fonts,
                                   atlas->m_width, atlas->m_height);
    // std::cout << bitmap.width << " " << bitmap.height << std::endl;
    auto *pixels =
        new std::vector<unsigned char>(3 * bitmap.width * bitmap.height);

    std::vector<unsigned char>::iterator it = pixels->begin();
    using msdfgen::pixelFloatToByte;
    for (int y = bitmap.height - 1; y >= 0; --y)
      for (int x = 0; x < bitmap.width; ++x) {
        *it++ = pixelFloatToByte(bitmap(x, y)[0]);
        *it++ = pixelFloatToByte(bitmap(x, y)[1]);
        *it++ = pixelFloatToByte(bitmap(x, y)[2]);
      }

    if (writeToFile) {
      auto maybeFname = Nan::To<v8::String>(info[1]);
      auto seriouslyThoughLikeWhy = maybeFname.ToLocalChecked();
      Nan::Utf8String str(seriouslyThoughLikeWhy);

      std::cout << "STRING: \"" << *str << "\"" << std::endl;
      if (msdf_atlas::saveImage(bitmap, msdf_atlas::ImageFormat::PNG,
                                strcmp(*str, "undefined") == 0 ||
                                        !(str.length() > 0)
                                    ? "atlas.png"
                                    : *str,
                                msdf_atlas::YDirection::BOTTOM_UP))
        std::cout << "Atlas image file saved." << std::endl;
      else {
        std::cout << "Failed to save the atlas as an image file." << std::endl;
      }
    }

    // std::cout << pixels->size() << "size" << std::endl;

    info.GetReturnValue().Set(
        Nan::NewBuffer((char *)pixels->data(), pixels->size(),
                       [](char *data, void *vec) {
                         delete reinterpret_cast<std::vector<unsigned char> *>(
                             vec);
                       },
                       pixels)
            .ToLocalChecked());
  }

  static NAN_METHOD(getInfo) {
    Atlas *atlas = Nan::ObjectWrap::Unwrap<Atlas>(info.This());

    std::ostringstream oss;
    if (msdf_atlas::exportJSON(atlas->m_fonts.data(), atlas->m_fonts.size(),
                               32, // emSize
                               2,  // pxRange
                               atlas->m_width, atlas->m_height,
                               msdf_atlas::ImageType::MSDF,
                               msdf_atlas::YDirection::BOTTOM_UP, oss,
                               true // kerning
                               )) {
      info.GetReturnValue().Set(Nan::New(oss.str()).ToLocalChecked());
    } else {
      // TODO(smolck)
    }
  }

  // TODO(smolck): static NAN_METHOD(removeFromCharset) {}
};
