'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { optimizeImage, validateImageFile } from '@/lib/utils/image-optimizer';
import { detectPincodeFromLocation } from '@/lib/utils/pincode-detector';
import { CATEGORY_OPTIONS } from '@/types/tam-retailer';

interface AddRetailerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  darkstore: string;
  userLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  pincodeData: any;
  onSuccess: () => void;
}

export function AddRetailerSheet({
  isOpen,
  onClose,
  darkstore,
  userLocation,
  pincodeData,
  onSuccess,
}: AddRetailerSheetProps) {
  const [shopName, setShopName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [shopPhoto, setShopPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect pincode from user location
  const detectedPincode = userLocation
    ? detectPincodeFromLocation(userLocation.latitude, userLocation.longitude, pincodeData)
    : null;

  // Check if location accuracy is within threshold
  const locationAccuracyOk = userLocation && userLocation.accuracy !== undefined
    ? userLocation.accuracy <= 100
    : false;

  // Validate phone number (only if there's input)
  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  // Form validation
  const canSubmit =
    shopPhoto !== null &&
    userLocation !== null &&
    locationAccuracyOk &&
    detectedPincode !== null &&
    (phoneNumber === '' || validatePhoneNumber(phoneNumber));

  // Reset form
  const resetForm = () => {
    setShopName('');
    setPhoneNumber('');
    setPhoneError(null);
    setSelectedCategories([]);
    setShopPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setSuccess(false);
  };

  // Handle phone number change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Only allow numeric input
    if (value && !/^\d*$/.test(value)) {
      return; // Don't update if non-numeric
    }

    setPhoneNumber(value);

    // Validate if there's input
    if (value) {
      if (value.length !== 10) {
        setPhoneError('Phone number must be exactly 10 digits');
      } else {
        setPhoneError(null);
      }
    } else {
      setPhoneError(null); // Clear error if field is empty
    }
  };

  // Handle photo selection
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file');
      return;
    }

    setShopPhoto(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!canSubmit || !userLocation || !detectedPincode || !shopPhoto) return;

    try {
      setUploading(true);
      setError(null);

      // Optimize image
      const optimizedBlob = await optimizeImage(shopPhoto);

      // Upload to Supabase Storage
      const fileName = `${darkstore}_${Date.now()}.webp`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tam-shop-photos')
        .upload(fileName, optimizedBlob, {
          contentType: 'image/webp',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('tam-shop-photos')
        .getPublicUrl(fileName);

      if (!urlData.publicUrl) throw new Error('Failed to get public URL');

      // Get device info
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };

      // Insert into tam_retailers table
      const { error: insertError } = await supabase.from('tam_retailers').insert({
        shop_name: shopName || null,
        phone_number: phoneNumber || null,
        shop_photo_url: urlData.publicUrl,
        category_tags: selectedCategories,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        location_accuracy: userLocation.accuracy || null,
        pincode: detectedPincode,
        darkstore: darkstore,
        user_agent: navigator.userAgent,
        device_info: deviceInfo,
      });

      if (insertError) throw insertError;

      // Success!
      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting retailer:', err);
      setError(err.message || 'Failed to add retailer');
    } finally {
      setUploading(false);
    }
  };

  // Reset form when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(resetForm, 300); // Wait for animation
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Retailer</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-green-50 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Retailer added successfully!</p>
                <p className="text-sm text-green-700">Form will reset in a moment...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Shop Photo */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Shop Photo <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
              disabled={uploading}
            />
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Shop preview"
                  className="h-20 w-full rounded-lg object-cover"
                />
                <button
                  onClick={() => {
                    setShopPhoto(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg hover:bg-red-600"
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                disabled={uploading}
              >
                <Camera className="h-8 w-8 text-gray-400" />
                <p className="text-xs font-medium text-gray-700">Capture photo</p>
              </button>
            )}
          </div>

          {/* Shop Name */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Shop Name <span className="text-gray-400">(Optional)</span>
            </label>
            <Input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Enter shop name"
              disabled={uploading}
            />
          </div>

          {/* Phone Number */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Phone Number <span className="text-gray-400">(Optional)</span>
            </label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="Enter 10-digit phone number"
              maxLength={10}
              disabled={uploading}
              className={phoneError ? 'border-red-500' : ''}
            />
            {phoneError && (
              <p className="mt-1 text-sm text-red-600">{phoneError}</p>
            )}
          </div>

          {/* Category Tags */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Category Tags <span className="text-gray-400">(Optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCategories.includes(category)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={uploading}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Location Data */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            {!userLocation && (
              <p className="text-sm text-red-600">Please enable location to continue</p>
            )}

            {userLocation && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">LatLong:</span>
                  <span className="font-mono font-medium text-gray-900">
                    {userLocation.latitude.toFixed(6)},{userLocation.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Accuracy:</span>
                  <span
                    className={`font-medium ${
                      locationAccuracyOk ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {userLocation.accuracy?.toFixed(2) || 'N/A'} m
                    {!locationAccuracyOk && ' (must be ≤100m)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pincode:</span>
                  <span
                    className={`font-medium ${
                      detectedPincode ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {detectedPincode || 'Not detected'}
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Sticky Footer with Submit Button */}
        <div className="border-t bg-white px-6 py-4">
          {/* Validation Messages */}
          {!canSubmit && (
            <div className="mb-3 space-y-1 text-sm text-gray-600">
              <p className="font-medium">Required to submit:</p>
              <ul className="list-inside list-disc space-y-1">
                {!shopPhoto && <li className="text-red-600">Shop photo</li>}
                {!userLocation && <li className="text-red-600">Location enabled</li>}
                {userLocation && !locationAccuracyOk && (
                  <li className="text-red-600">Location accuracy ≤100m</li>
                )}
                {userLocation && !detectedPincode && (
                  <li className="text-red-600">Location within pincode boundaries</li>
                )}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
