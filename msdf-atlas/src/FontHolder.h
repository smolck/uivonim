#pragma once

#include <msdf-atlas-gen.h>

class FontHolder {
  msdfgen::FreetypeHandle *ft;
  msdfgen::FontHandle *font;
  const char *fontFilename;

public:
  FontHolder()
      : ft(msdfgen::initializeFreetype()), font(nullptr),
        fontFilename(nullptr) {}
  ~FontHolder() {
    if (ft) {
      if (font)
        msdfgen::destroyFont(font);
      msdfgen::deinitializeFreetype(ft);
    }
  }
  bool load(const char *fontFilename) {
    if (ft && fontFilename) {
      if (this->fontFilename && !strcmp(this->fontFilename, fontFilename))
        return true;
      if (font)
        msdfgen::destroyFont(font);
      if ((font = msdfgen::loadFont(ft, fontFilename))) {
        this->fontFilename = fontFilename;
        return true;
      }
      this->fontFilename = nullptr;
    }
    return false;
  }
  operator msdfgen::FontHandle *() const { return font; }
};
